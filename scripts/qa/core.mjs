import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const QA_DIR = path.join(ROOT, '.qa');
export const TARGET = Object.freeze({
  deployment: 'dev:content-poodle-172',
  cloudUrl: 'https://content-poodle-172.eu-west-1.convex.cloud',
  siteUrl: 'https://content-poodle-172.eu-west-1.convex.site',
});
export const APPS = Object.freeze({
  admin: { port: 3102, readiness: '/sign-in' },
  teacher: { port: 3101, readiness: '/sign-in' },
  portal: { port: 3103, readiness: '/sign-in' },
});
export const LOCK_DIR = path.join(os.tmpdir(), `melo-agent-qa-${process.getuid?.() ?? 'user'}`);
const targetKeys = {
  CONVEX_DEPLOYMENT: TARGET.deployment,
  CONVEX_URL: TARGET.cloudUrl,
  NEXT_PUBLIC_CONVEX_URL: TARGET.cloudUrl,
  DEMO_SEED_EXPECTED_CLOUD_URL: TARGET.cloudUrl,
  CONVEX_SITE_URL: TARGET.siteUrl,
  NEXT_PUBLIC_CONVEX_SITE_URL: TARGET.siteUrl,
};

export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^["']/.test(value)) {
      const end = value.indexOf(value[0], 1);
      if (end < 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1))) throw new Error(`Invalid quoted value for ${match[1]}`);
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}

export function assertTarget(values, source, required = false) {
  for (const [key, expected] of Object.entries(targetKeys)) {
    if (values[key] !== undefined && values[key] !== expected) throw new Error(`${source}: ${key} does not match the approved test deployment.`);
  }
  if (required) {
    for (const key of ['CONVEX_DEPLOYMENT', 'DEMO_SEED_EXPECTED_CLOUD_URL']) {
      if (values[key] !== targetKeys[key]) throw new Error(`${source}: ${key} is required.`);
    }
    for (const key of ['DEMO_SEED_OPERATOR_TOKEN', 'DEMO_SEED_DEPLOYMENT_IDENTITY']) {
      if (!values[key]?.trim()) throw new Error(`${source}: ${key} is required for inspection.`);
    }
    if (values.DEMO_SEED_DEPLOYMENT_ENV !== 'development') throw new Error(`${source}: development operator gate is required.`);
  }
}

export function parseApps(value = 'admin') {
  const names = value.split(',');
  if (!names.length || names.some(name => !Object.hasOwn(APPS, name)) || new Set(names).size !== names.length) {
    throw new Error('Choose distinct apps from admin,teacher,portal. Other app origins have not been attested yet.');
  }
  return names;
}

export function readJson(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
export function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filename);
}

export function loadProfile(filename) {
  const absolute = fs.realpathSync(path.resolve(ROOT, filename));
  const values = parseEnv(fs.readFileSync(absolute, 'utf8'));
  assertTarget(values, 'QA profile', true);
  assertTarget(process.env, 'Shell');
  return { filename: absolute, values };
}

export function assertAppTargets(apps, root = ROOT) {
  for (const directory of [root, ...apps.map(app => path.join(root, 'apps', app))]) {
    for (const name of ['.env', '.env.development', '.env.local', '.env.development.local']) {
      const filename = path.join(directory, name);
      if (fs.existsSync(filename)) assertTarget(parseEnv(fs.readFileSync(filename, 'utf8')), `${path.relative(root, filename)}`);
    }
  }
}

export async function portAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    // An IPv6 wildcard detects both families on the supported Mac/Linux hosts.
    server.listen({ port, host: '::', exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export function acquireLease(name, owner, directory = LOCK_DIR) {
  if (!/^[a-z0-9-]+$/.test(name) || !/^[a-z0-9-]+$/.test(owner.id)) throw new Error('Invalid lease identifier.');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `${name}.json`);
  try { fs.writeFileSync(filename, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`QA lease ${name} is already reserved. Run qa:stop in its owning worktree; leases are never stolen automatically.`);
    throw error;
  }
  return filename;
}

export function releaseLease(filename, id) {
  if (!fs.existsSync(filename)) return;
  if (readJson(filename).id !== id) throw new Error('Lease belongs to another run; refusing removal.');
  fs.unlinkSync(filename);
}

export function ownsSupervisor(state, command) {
  return Number.isInteger(state.pid) && state.pid > 1 && /^[a-z0-9-]+$/.test(state.id) &&
    command.includes(path.join(ROOT, 'scripts/qa/supervisor.mjs')) && command.endsWith(` --id ${state.id}`);
}
export function processCommand(pid) {
  try { return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

export function appEnvironment(profile) {
  const runtimeKeys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'CI', 'NO_COLOR', 'PNPM_HOME'];
  const env = Object.fromEntries(runtimeKeys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  const frontendTargets = Object.fromEntries(Object.entries(targetKeys).filter(([key]) => !key.startsWith('DEMO_SEED_')));
  Object.assign(env, frontendTargets, {
    TRUSTED_ORIGINS: Object.values(APPS).map(app => `http://localhost:${app.port}`).join(','),
    NODE_OPTIONS: '--no-network-family-autoselection --dns-result-order=ipv4first',
  });
  // Secrets from the operator profile are deliberately not passed to Next.js.
  void profile;
  return env;
}

export async function inspectBackend(values) {
  const { ConvexHttpClient } = await import('convex/browser');
  const { makeFunctionReference } = await import('convex/server');
  const client = new ConvexHttpClient(TARGET.cloudUrl, { logger: false });
  let result;
  try {
    result = await Promise.race([
      client.action(makeFunctionReference('functions/academic/demoPreflightAction:inspectDemoSchool'), {
        operatorToken: values.DEMO_SEED_OPERATOR_TOKEN,
        targetIdentity: values.DEMO_SEED_DEPLOYMENT_IDENTITY,
      }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Inspection timeout')), 60_000); timer.unref(); }),
    ]);
  } catch { throw new Error('Read-only backend inspection failed. No seed/reset was invoked. Check the operator profile and server configuration privately.'); }
  if (result.cloudUrl !== TARGET.cloudUrl || result.school?.name !== 'Demo Academy' ||
      result.e2eOriginsTrusted !== true || result.ready !== true || result.blockers?.length) {
    throw new Error('Backend identity, demo cohort, or trusted origins failed inspection. No seed/reset was invoked.');
  }
  const counts = Object.fromEntries(['students', 'classes', 'studentInvoices', 'assessmentRecords'].map(name => [name, result.tables?.find(row => row.name === name)?.count]));
  if (Object.values(counts).some(count => !Number.isInteger(count) || count < 1)) throw new Error('Required demo fixtures are missing; no automatic repair.');
  return { deployment: TARGET.deployment, school: 'Demo Academy', originsTrusted: true, counts };
}

export async function doctor(profile, apps, { requireFreePorts = true } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('QA requires Node 22 or newer.');
  assertAppTargets(apps);
  try { execFileSync('pnpm', ['--version'], { stdio: 'ignore' }); }
  catch { throw new Error('Install pnpm before running QA.'); }
  let chromium;
  try { ({ chromium } = await import('@playwright/test')); }
  catch { throw new Error('Run pnpm install --frozen-lockfile in this worktree.'); }
  if (!fs.existsSync(chromium.executablePath())) throw new Error('Run pnpm test:e2e:install in this worktree.');
  for (const app of apps) {
    if (requireFreePorts && !await portAvailable(APPS[app].port)) throw new Error(`${app}: trusted port ${APPS[app].port} is occupied. No existing server will be borrowed or killed.`);
  }
  const backend = await inspectBackend(profile.values);
  return { checkedAt: new Date().toISOString(), backend, apps: apps.map(name => ({ name, origin: `http://localhost:${APPS[name].port}` })) };
}

export function evidenceStatus(checks) {
  if (!checks.length) return 'blocked';
  if (checks.some(check => check.status === 'failed')) return 'failed';
  if (checks.some(check => check.status === 'blocked' || check.status === 'skipped')) return 'blocked';
  if (checks.every(check => check.status === 'passed')) return 'passed';
  throw new Error('Unknown check status.');
}

export function isBackendContractBlocker(messages) {
  return messages.some(message => /ArgumentValidationError/.test(message) &&
    /extra field `(?:formatHint|guidance|sourcePresetId|sourcePresetVersion)`/.test(message));
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
