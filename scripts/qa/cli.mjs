import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  ROOT, QA_DIR, TARGET, APPS, LOCK_DIR, readJson, writeJson, parseApps, loadProfile,
  doctor, acquireLease, releaseLease, ownsSupervisor, processCommand, workspaceRevision, appEnvironment, withLease,
} from './core.mjs';
import { workflowRequirements } from './exploration.mjs';
import { generateReport, publishReviewed } from './report.mjs';

const stateFile = path.join(QA_DIR, 'state.json');
const configFile = path.join(QA_DIR, 'config.json');

export function options(args) {
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--publish-reviewed') { values.publish = true; continue; }
    if (key === '--allow-synthetic-writes') { values.allowWrites = true; continue; }
    if (!['--env-file', '--apps', '--run', '--roles', '--role', '--script'].includes(key) || !args[index + 1] || args[index + 1].startsWith('--') || values[key]) {
      throw new Error('Use the documented env/apps/run/roles/role/script flags; unsupported or missing values are refused.');
    }
    values[key] = args[++index];
  }
  return values;
}

export function validateOptions(command, opts) {
  const allowed = command === 'doctor' || command === 'start' ? ['--env-file', '--apps'] : command === 'report' ? ['--run', 'publish'] :
    command === 'roles' ? ['--roles'] : command === 'explore' ? ['--role', '--script', 'allowWrites'] : [];
  if (Object.keys(opts).some(key => !allowed.includes(key))) throw new Error(`Unsupported option for qa:${command}. No option is silently ignored.`);
}

function config(opts) {
  const previous = fs.existsSync(configFile) ? readJson(configFile) : {};
  const profile = loadProfile(opts['--env-file'] ?? process.env.QA_ENV_FILE ?? previous.profile ?? '.env.qa.local');
  const apps = parseApps(opts['--apps'] ?? previous.apps?.join(',') ?? 'admin');
  return { profile, apps };
}

function ownedState() {
  if (!fs.existsSync(stateFile)) throw new Error('Run qa:start first.');
  const state = readJson(stateFile);
  if (state.root !== ROOT || !ownsSupervisor(state, processCommand(state.pid))) {
    throw new Error('Recorded server owner is not running. No unrelated PID will be signalled or server borrowed. Inspect .qa/state.json and its port leases privately.');
  }
  return state;
}

async function start(opts) {
  if (fs.existsSync(stateFile)) {
    const state = readJson(stateFile);
    if (['starting', 'ready'].includes(state.status)) throw new Error('This worktree already has an active QA state. Run qa:stop first.');
  }
  const { profile, apps } = config(opts);
  const inspection = await doctor(profile, apps);
  const id = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const leases = [];
  try {
    for (const name of apps) leases.push(acquireLease(`port-${APPS[name].port}`, { id, root: ROOT }));
    writeJson(configFile, { profile: profile.filename, apps });
    writeJson(stateFile, { id, root: ROOT, profile: profile.filename, apps, leases, status: 'starting', inspection });
    const log = fs.openSync(path.join(QA_DIR, 'supervisor.log'), 'a', 0o600);
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts/qa/supervisor.mjs'), '--id', id], {
      cwd: ROOT, stdio: ['ignore', log, log], detached: true,
    });
    fs.closeSync(log);
    child.unref();
    let spawnFailure;
    child.on('error', error => { spawnFailure = error; });
    const deadline = Date.now() + 190_000;
    while (Date.now() < deadline) {
      if (spawnFailure) throw new Error('QA supervisor could not start.');
      const state = readJson(stateFile);
      if (state.id !== id) throw new Error('QA state owner changed.');
      if (state.status === 'ready') {
        console.log(`QA ready in ${ROOT}`);
        for (const name of apps) console.log(`${name}: http://localhost:${APPS[name].port}`);
        console.log('Use qa:stop to stop only these owned servers.');
        return;
      }
      if (['failed', 'stopped'].includes(state.status)) throw new Error('QA startup failed. Logs are private under .qa/.');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const state = readJson(stateFile);
    if (ownsSupervisor(state, processCommand(state.pid))) process.kill(state.pid, 'SIGTERM');
    throw new Error('QA startup timed out; owned supervisor was asked to stop.');
  } catch (error) {
    const state = fs.existsSync(stateFile) ? readJson(stateFile) : {};
    // A live supervisor owns cleanup. Never release reservations beneath it.
    if (!ownsSupervisor(state, processCommand(state.pid))) {
      for (const lease of leases) releaseLease(lease, id);
      if (state.id === id) writeJson(stateFile, { ...state, status: 'failed' });
    }
    throw error;
  }
}

async function stop() {
  const state = ownedState();
  if (fs.existsSync(path.join(LOCK_DIR, 'backend-content-poodle-172.json'))) throw new Error('A browser run holds the backend lease. Let it finish before stopping servers.');
  process.kill(state.pid, 'SIGTERM');
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (readJson(stateFile).status === 'stopped' || readJson(stateFile).status === 'failed') { console.log('Owned QA servers stopped; port leases released.'); return; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Supervisor did not acknowledge shutdown. No other process was killed.');
}

async function browserRun(mode, opts) {
  const requirements = workflowRequirements(mode, opts);
  const state = ownedState();
  if (state.status !== 'ready') throw new Error('QA servers are not ready.');
  const profile = loadProfile(state.profile);
  await doctor(profile, state.apps, { requireFreePorts: false });
  for (const app of requirements.apps) if (!state.apps.includes(app)) throw new Error(`${mode} requires an owned ${app} server. Use qa:start --apps with the required apps.`);
  const id = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await withLease('backend-content-poodle-172', { id, root: ROOT, pid: process.pid }, async () => {
    const directory = path.join(QA_DIR, 'runs', id);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeJson(path.join(directory, 'request.json'), { id, mode, apps: state.apps, deployment: TARGET.deployment, ...requirements, workspace: workspaceRevision() });
    writeJson(path.join(QA_DIR, 'latest-run.json'), { id });
    const code = await new Promise((resolve, reject) => {
      const runner = mode === 'roles' || mode === 'explore' ? 'browser-runner.mjs' : 'journey.mjs';
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts/qa', runner), directory], {
        cwd: ROOT, stdio: 'inherit', env: { ...appEnvironment(profile),
          QA_ADMIN_PASSWORD: profile.values.E2E_ADMIN_PASSWORD ?? 'Admin123!Pass',
          QA_TEACHER_PASSWORD: profile.values.E2E_TEACHER_PASSWORD ?? 'Teacher123!Pass',
          QA_PARENT_PASSWORD: profile.values.E2E_PORTAL_PASSWORD ?? 'Portal123!Pass',
        },
      });
      const limit = setTimeout(() => {
        child.kill('SIGTERM');
        force = setTimeout(() => child.kill('SIGKILL'), 10_000);
      }, 15 * 60_000);
      let force;
      child.once('error', error => { clearTimeout(limit); clearTimeout(force); reject(error); });
      child.once('exit', value => { clearTimeout(limit); clearTimeout(force); resolve(value ?? 1); });
    });
    if (!fs.existsSync(path.join(directory, 'result.json'))) writeJson(path.join(directory, 'result.json'), {
      ...readJson(path.join(directory, 'request.json')), status: 'blocked', scope: 'Runner did not finish; feature criteria were not verified.',
      checks: [{ name: 'Browser runner completion', status: 'blocked', note: 'Process exit or time limit prevented completion. Inspect any ambiguous writes before retrying.' }], screenshots: [],
    });
    generateReport(directory);
    console.log(`Private report: ${path.join(directory, 'index.html')}`);
    console.log(`Run: ${id}. Review screenshots before qa:report --run ${id} --publish-reviewed.`);
    process.exitCode = code;
  });
}

export async function main(command, opts) {
  validateOptions(command, opts);
  if (command === 'doctor') {
    const { profile, apps } = config(opts);
    let requireFreePorts = true;
    if (fs.existsSync(stateFile) && ['starting', 'ready', 'stopping'].includes(readJson(stateFile).status)) {
      const state = ownedState();
      if (state.status !== 'ready' || state.profile !== profile.filename || apps.some(app => !state.apps.includes(app))) throw new Error('Doctor selection does not match this ready, owned QA environment.');
      requireFreePorts = false;
      for (const app of apps) {
        const response = await fetch(`http://localhost:${APPS[app].port}${APPS[app].readiness}`, { redirect: 'manual', signal: AbortSignal.timeout(5_000) });
        if (response.status !== 200) throw new Error(`${app} owned server is not ready.`);
      }
    }
    const result = await doctor(profile, apps, { requireFreePorts });
    writeJson(configFile, { profile: profile.filename, apps });
    writeJson(path.join(QA_DIR, 'doctor.json'), result);
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'start') await start(opts);
  else if (command === 'stop') await stop();
  else if (['smoke', 'feature', 'layout', 'roles', 'explore'].includes(command)) await browserRun(command, opts);
  else if (command === 'report') {
    const id = opts['--run'] ?? readJson(path.join(QA_DIR, 'latest-run.json')).id;
    if (!/^qa-[a-z0-9-]+$/.test(id)) throw new Error('Invalid run ID.');
    const directory = path.join(QA_DIR, 'runs', id);
    const result = generateReport(directory);
    console.log(`Status: ${result.status}; local report: ${path.join(directory, 'index.html')}`);
    if (opts.publish) console.log(publishReviewed(directory));
  } else throw new Error('Use doctor, start, stop, smoke, layout, feature, roles, explore, or report.');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  Promise.resolve().then(() => main(process.argv[2], options(process.argv.slice(3)))).catch(error => {
    // Only local safety errors are emitted; remote service errors are sanitized in core.
    console.error(error.message);
    process.exitCode = 1;
  });
}
