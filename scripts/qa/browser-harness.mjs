import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect as playwrightExpect } from '@playwright/test';
import { APPS, TARGET, QA_DIR, ROOT, LOCK_DIR, readJson, writeJson, ownsSupervisor, processCommand, assertAppTargets, evidenceStatus, isBackendContractBlocker } from './core.mjs';

export const expect = playwrightExpect.configure({ timeout: 30_000 });
export const ROLES = Object.freeze({
  admin: { app: 'admin', email: 'admin@demo-academy.school', password: 'Admin123!Pass' },
  teacher: { app: 'teacher', email: 'teacher@demo-academy.school', password: 'Teacher123!Pass' },
  parent: { app: 'portal', email: 'parent@demo-academy.school', password: 'Portal123!Pass' },
});
export function parseRoles(value = 'admin,teacher,parent') {
  const roles = value.split(',');
  if (roles.some(role => !Object.hasOwn(ROLES, role)) || new Set(roles).size !== roles.length) throw new Error('Choose distinct roles from admin,teacher,parent.');
  return roles;
}
export function validateExploration(module) {
  if (typeof module.scope !== 'string' || !module.scope.trim() || module.scope.length > 1000 ||
      !Array.isArray(module.steps) || module.steps.length < 1 || module.steps.length > 30 ||
      module.steps.some(step => typeof step.name !== 'string' || !step.name.trim() || step.name.length > 160 || typeof step.run !== 'function') ||
      new Set(module.steps.map(step => step.name)).size !== module.steps.length ||
      !['read-only', 'synthetic-writes'].includes(module.effects)) {
    throw new Error('Exploration exports scope, effects (read-only or synthetic-writes), and 1-30 uniquely named steps with run functions.');
  }
}
export function validateWorkflow(module) {
  if (!Array.isArray(module.phases) || module.phases.length < 1 || module.phases.length > 20) throw new Error('Workflow requires 1-20 ordered phases.');
  const seen = new Set();
  for (const phase of module.phases) {
    if (!/^[a-z0-9-]+$/.test(phase.id ?? '') || seen.has(phase.id) || !Object.hasOwn(ROLES, phase.role) ||
        phase.dependsOn?.some(id => !seen.has(id)) || phase.alwaysRun !== undefined && typeof phase.alwaysRun !== 'boolean') throw new Error('Workflow phase identity, role, or dependency is invalid.');
    validateExploration({ scope: module.scope, effects: module.effects, steps: phase.steps });
    seen.add(phase.id);
  }
}

export function registerOriginGuards(context, apps, diagnostics) {
  context.route('**/*', route => {
    const request = route.request();
    if (allowedBrowserUrl(request.url(), apps, { method: request.method(), resourceType: request.resourceType() })) return route.continue();
    diagnostics.blockedRequests++;
    const origin = new URL(request.url()).origin;
    if (!diagnostics.blockedOrigins.includes(origin)) diagnostics.blockedOrigins.push(origin);
    return route.abort('blockedbyclient');
  });
  context.routeWebSocket('**/*', socket => {
    if (allowedBrowserUrl(socket.url(), apps, { resourceType: 'websocket' })) return socket.connectToServer();
    diagnostics.blockedRequests++;
    const origin = new URL(socket.url()).origin;
    if (!diagnostics.blockedOrigins.includes(origin)) diagnostics.blockedOrigins.push(origin);
    return socket.close({ code: 1008, reason: 'QA origin is not approved' });
  });
}

export function ownedRequest(runDirectory, modes) {
  const directory = fs.realpathSync(runDirectory);
  if (!directory.startsWith(`${path.join(QA_DIR, 'runs')}${path.sep}`)) throw new Error('Use this worktree QA run folder.');
  const request = readJson(path.join(directory, 'request.json'));
  const state = readJson(path.join(QA_DIR, 'state.json'));
  const lease = readJson(path.join(LOCK_DIR, 'backend-content-poodle-172.json'));
  if (!modes.includes(request.mode) || request.deployment !== TARGET.deployment || lease.id !== request.id || lease.root !== ROOT ||
      state.root !== ROOT || state.status !== 'ready' || !ownsSupervisor(state, processCommand(state.pid))) throw new Error('Browser environment is not owned by this verified QA worktree.');
  assertAppTargets(state.apps);
  return { directory, request, state };
}
export function allowedBrowserUrl(value, apps, { method = 'GET', resourceType = '' } = {}) {
  if (value === 'about:blank' || value.startsWith('data:') || value.startsWith('blob:')) return true;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    // The app loads public Google Fonts. Permit only font CSS/files, not XHR,
    // scripts, provider operations, or arbitrary third-party traffic.
    if (url.protocol === 'https:' && method === 'GET') {
      if (url.origin === 'https://fonts.googleapis.com' && resourceType === 'stylesheet' && ['/css', '/css2'].includes(url.pathname)) return true;
      if (url.origin === 'https://fonts.gstatic.com' && resourceType === 'font' && (url.pathname.startsWith('/s/') || url.pathname === '/l/font')) return true;
    }
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    const origins = [TARGET.cloudUrl, TARGET.siteUrl, ...apps.map(app => `http://localhost:${APPS[app].port}`)];
    return origins.includes(url.origin);
  } catch { return false; }
}

export class BrowserHarness {
  constructor(directory, request, state, scope) {
    this.directory = directory;
    this.state = state;
    this.result = { ...request, scope, status: 'blocked', checks: [], screenshots: [] };
    this.diagnostics = [];
    this.planned = [];
    this.roleSessions = new Map();
  }
  declareSteps(role, steps, phase = '') {
    const label = phase ? `${role}/${phase}` : role;
    const names = [`${label}: ${phase ? 'authenticated fixture session' : 'real fixture sign-in'}`, ...steps.map(step => `${label}: ${step.name}`), `${label}: no browser errors or out-of-scope requests`];
    for (const name of names) if (!this.planned.includes(name)) this.planned.push(name);
    return names;
  }
  record(name, status, note) {
    if (!this.planned.includes(name)) this.planned.push(name);
    if (!this.result.checks.some(check => check.name === name)) this.result.checks.push({ name, status, ...(note ? { note } : {}) });
  }
  blockPending(note = 'Not exercised before the workflow ended or was interrupted.') {
    for (const name of this.planned) if (!this.result.checks.some(check => check.name === name)) this.record(name, 'blocked', note);
  }
  async begin() { this.browser = await chromium.launch({ headless: true }); }
  async actor(role, phase = '') {
    const key = phase ? `${role}-${phase}` : role;
    const account = ROLES[role];
    if (!account || !this.state.apps.includes(account.app)) throw new Error('Requested role app is not owned by this run.');
    const origin = `http://localhost:${APPS[account.app].port}`;
    const diagnostics = { role, phase, errors: [], consoleErrors: [], blockedRequests: 0, blockedOrigins: [] };
    this.diagnostics.push(diagnostics);
    const configure = context => registerOriginGuards(context, this.state.apps, diagnostics);
    const observe = page => {
      page.setDefaultTimeout(30_000);
      page.on('pageerror', error => diagnostics.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
    };
    let context = await this.browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } });
    await configure(context);
    let page = await context.newPage();
    observe(page);
    try {
      let session = phase ? this.roleSessions.get(role) : null;
      if (!session) {
        await page.goto('/sign-in');
        await expect(page.locator('#email')).toBeVisible();
        await page.locator('#email').fill(account.email);
        await page.locator('#password').fill(process.env[`QA_${role.toUpperCase()}_PASSWORD`] ?? account.password);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await page.waitForURL(url => url.origin === origin && url.pathname !== '/sign-in', { timeout: 60_000 });
        session = await context.storageState();
        if (phase) this.roleSessions.set(role, session);
      }
      // Credentials and sign-in requests are excluded from video/trace artifacts.
      // Cached role sessions exist only in this process memory.
      await context.close();
      context = await this.browser.newContext({ baseURL: origin, storageState: session, viewport: { width: 1440, height: 1000 }, recordVideo: { dir: path.join(this.directory, `private-video-${key}`) } });
      await configure(context);
      page = await context.newPage();
      observe(page);
      if (phase) {
        const response = await context.request.get(`${origin}/api/auth/get-session`);
        const current = response.ok() ? await response.json() : null;
        if (current?.user?.email !== account.email) throw new Error('Cached fixture session could not be verified; no phase actions executed.');
      }
      await context.tracing.start({ screenshots: true, snapshots: true });
      return { role, phase, key, origin, page, context, diagnostics, expect,
        capture: async (name, element) => {
          if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Use a URL-safe screenshot name.');
          const filename = `${key}-${name}.png`;
          if (this.result.screenshots.includes(filename)) throw new Error('Screenshot names must be unique within the run.');
          if (element) await element.screenshot({ path: path.join(this.directory, filename), mask: [page.locator('input[type="password"]')] });
          else await page.screenshot({ path: path.join(this.directory, filename), fullPage: true, mask: [page.locator('input[type="password"]')] });
          this.result.screenshots.push(filename);
        },
      };
    } catch (error) { await context.close(); throw error; }
  }
  async runSteps(role, steps, { phase = '', shared } = {}) {
    const key = phase ? `${role}-${phase}` : role;
    const plan = this.declareSteps(role, steps, phase);
    let actor;
    let position = 0;
    try {
      actor = await this.actor(role, phase);
      actor.shared = shared;
      this.record(plan[position++], 'passed');
      for (const step of steps) {
        await step.run(actor);
        this.record(plan[position++], 'passed');
      }
      await expect(actor.diagnostics.errors.length).toBe(0);
      await expect(actor.diagnostics.consoleErrors.length).toBe(0);
      await expect(actor.diagnostics.blockedRequests).toBe(0);
      this.record(plan[position], 'passed');
    } catch (error) {
      const diagnostics = actor?.diagnostics ?? this.diagnostics.find(row => row.role === role && (row.phase ?? '') === phase);
      const blocker = !actor || diagnostics?.blockedRequests > 0 || isBackendContractBlocker([...(diagnostics?.consoleErrors ?? []), ...(diagnostics?.errors ?? [])]);
      this.record(plan[position], blocker ? 'blocked' : 'failed', blocker
        ? 'Fixture, backend contract, or approved-origin prerequisite was unavailable. No automatic deployment or reset.'
        : 'Browser assertion failed; raw diagnostics remain private.');
      fs.writeFileSync(path.join(this.directory, `private-${key}-failure.txt`), String(error.stack ?? error), { mode: 0o600 });
      if (actor) { try { await actor.capture('failure'); } catch { /* Context may have exited. */ } }
      for (const name of plan.slice(position + 1)) this.record(name, 'blocked', 'Not exercised after a failed prerequisite or assertion.');
    } finally {
      if (actor) {
        try { await actor.context.tracing.stop({ path: path.join(this.directory, `private-${key}-trace.zip`) }); } catch { /* Preserve other evidence if tracing failed. */ }
        if (phase) {
          try { this.roleSessions.set(role, await actor.context.storageState()); }
          catch { this.roleSessions.delete(role); } // A later phase can sign in again.
        }
        try { await actor.context.close(); } catch { /* Context may already have exited. */ }
      }
    }
    return plan.every(name => this.result.checks.find(check => check.name === name)?.status === 'passed');
  }
  async finish() {
    await this.browser?.close();
    this.blockPending();
    this.result.plannedChecks = [...this.planned];
    this.result.status = evidenceStatus(this.result.checks);
    writeJson(path.join(this.directory, 'result.json'), this.result);
    writeJson(path.join(this.directory, 'private-browser-errors.json'), this.diagnostics);
    console.log(`QA ${this.result.mode}: ${this.result.status}. ${this.result.checks.filter(check => check.status === 'passed').length}/${this.result.checks.length} checks passed.`);
    process.exitCode = this.result.status === 'passed' ? 0 : 1;
  }
}
