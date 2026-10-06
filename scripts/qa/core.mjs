import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import dns from 'node:dns';
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
export function backendRecoveryFile(deployment = TARGET.deployment, directory = LOCK_DIR) {
  const safeDeployment = String(deployment).replace(/[^a-z0-9_-]/gi, '_');
  return path.join(directory, `recovery-${safeDeployment}.json`);
}
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
export function isCleanStoppedState(state, root = ROOT) {
  return state?.root === root && state.status === 'stopped' && Array.isArray(state.leases) && state.leases.every(filename => !fs.existsSync(filename));
}
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

export async function withLease(name, owner, action, directory = LOCK_DIR) {
  const filename = acquireLease(name, owner, directory);
  try { return await action(); }
  finally { releaseLease(filename, owner.id); }
}

export function releaseLease(filename, id) {
  if (!fs.existsSync(filename)) return;
  if (readJson(filename).id !== id) throw new Error('Lease belongs to another run; refusing removal.');
  fs.unlinkSync(filename);
}

export function ownsSupervisor(state, command) {
  const normalizedCommand = command.replaceAll('\\', '/');
  const normalizedScript = path.join(ROOT, 'scripts/qa/supervisor.mjs').replaceAll('\\', '/');
  return Number.isInteger(state.pid) && state.pid > 1 && /^[a-z0-9-]+$/.test(state.id) &&
    normalizedCommand.includes(normalizedScript) && normalizedCommand.endsWith(` --id ${state.id}`);
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
      client.action(makeFunctionReference('functions/academic/qaInspection:inspectQaEnvironment'), {
        operatorToken: values.DEMO_SEED_OPERATOR_TOKEN,
        targetIdentity: values.DEMO_SEED_DEPLOYMENT_IDENTITY,
      }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Inspection timeout')), 60_000); timer.unref(); }),
    ]);
  } catch { throw new Error('Read-only backend inspection failed. No seed/reset was invoked. Check the operator profile and server configuration privately.'); }
  return validateQaInspection(result);
}

export function validateQaInspection(result) {
  if (result.cloudUrl !== TARGET.cloudUrl || result.schoolName !== 'Demo Academy' || result.qaReady !== true ||
      result.originsTrusted !== true || result.baselineStudents !== 36 || result.baselineClasses !== 3 || !/^[a-f0-9]{64}$/.test(result.baselineDigest ?? '')) {
    throw new Error('QA identity, original cohort, or trusted origins failed inspection. This is not reset readiness; no seed/reset was invoked.');
  }
  const counts = result.counts;
  if (!counts || ['students', 'classes', 'studentInvoices', 'assessmentRecords'].some(name => !Number.isInteger(counts[name]) || counts[name] < 1) || counts.students < 36 || counts.classes < 3) throw new Error('Required QA fixtures are missing; no automatic repair.');
  return { deployment: TARGET.deployment, school: 'Demo Academy', originsTrusted: true, counts,
    baseline: { students: 36, classes: 3, digest: result.baselineDigest },
    activePeriod: { session: result.activeSession, term: result.activeTerm }, retainedQaClaims: result.retainedQaClaims };
}

export async function doctor(profile, apps, { requireFreePorts = true, allowRecovery = false } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('QA requires Node 22 or newer.');
  // Match Melo app DNS behavior only after reporting unsupported Node versions.
  if (typeof net.setDefaultAutoSelectFamily === 'function') net.setDefaultAutoSelectFamily(false);
  if (typeof dns.setDefaultResultOrder === 'function') dns.setDefaultResultOrder('ipv4first');
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
  const recoveryFile = backendRecoveryFile(profile.values.CONVEX_DEPLOYMENT ?? TARGET.deployment);
  if (fs.existsSync(recoveryFile)) {
    validateRecoveryState(readJson(recoveryFile), backend, { allowRecovery });
  }
  return { checkedAt: new Date().toISOString(), backend, apps: apps.map(name => ({ name, origin: `http://localhost:${APPS[name].port}` })) };
}

export function preservationExpectation(inspection, recovery) {
  if (!inspection?.baseline?.digest || !inspection?.activePeriod?.session || !inspection?.activePeriod?.term) throw new Error('Independent pre-write baseline and active period are required.');
  if (!recovery) return { activePeriod: inspection.activePeriod, baselineDigest: inspection.baseline.digest };
  if (recovery.deployment !== TARGET.deployment ||
      !recovery.activePeriod?.session || !recovery.activePeriod?.term || recovery.baselineDigest !== inspection.baseline.digest) {
    throw new Error('Recovery marker does not match the independently inspected original school baseline.');
  }
  return { activePeriod: recovery.activePeriod, baselineDigest: recovery.baselineDigest };
}

export function validateRecoveryState(marker, backend, { allowRecovery = false } = {}) {
  if (marker.deployment !== TARGET.deployment || !backend?.baseline?.digest || marker.baselineDigest !== backend.baseline.digest) throw new Error('Recovery marker does not match the deployment and original cohort. Pause and inspect locally.');
  const restored = Boolean(marker.activePeriod?.session && marker.activePeriod?.term && JSON.stringify(marker.activePeriod) === JSON.stringify(backend.activePeriod));
  if (!restored && !allowRecovery) throw new Error('Interrupted QA changed the active school calendar. Use the explicitly recorded recovery workflow before starting more tests.');
  return { restored, target: marker.activePeriod };
}

export function evidenceStatus(checks) {
  if (!checks.length) return 'blocked';
  if (checks.some(check => check.status === 'failed')) return 'failed';
  if (checks.some(check => check.status === 'blocked' || check.status === 'skipped')) return 'blocked';
  if (checks.every(check => check.status === 'passed')) return 'passed';
  throw new Error('Unknown check status.');
}

export function isBackendContractBlocker(messages) {
  return messages.some(message => /Could not find public function for/.test(message) ||
    /ArgumentValidationError/.test(message) && /extra field `(?:formatHint|guidance|sourcePresetId|sourcePresetVersion)`/.test(message));
}

export function workspaceRevision(root = ROOT) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let upstreamRevision = null;
  try { upstreamRevision = git(['rev-parse', 'origin/master']); } catch { /* A fresh clone may have no upstream ref. */ }
  return { checkoutRevision: git(['rev-parse', 'HEAD']), upstreamRevision, sourceDirty: git(['status', '--porcelain=v1']) !== '',
    backendCodeRevision: null, backendCodeNote: 'Preflight attests deployment and fixtures, not a deployed source revision. Passing a journey does not verify other upstream features.' };
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
