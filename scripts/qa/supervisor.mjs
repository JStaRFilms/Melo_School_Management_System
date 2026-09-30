import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, QA_DIR, APPS, readJson, writeJson, loadProfile, appEnvironment, releaseLease } from './core.mjs';

const id = process.argv[3];
const stateFile = path.join(QA_DIR, 'state.json');
let state = readJson(stateFile);
if (process.argv[2] !== '--id' || state.id !== id) throw new Error('Supervisor owner mismatch.');
const profile = loadProfile(state.profile);
const children = [];
let stopping = false;
let failure = false;
state.pid = process.pid;
writeJson(stateFile, state);

async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already stopped. */ }
    }
  }
  await new Promise(resolve => setTimeout(resolve, 2_000));
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
    }
  }
  for (const lease of state.leases) releaseLease(lease, id);
  if (readJson(stateFile).id === id) writeJson(stateFile, { ...state, status: failure ? 'failed' : 'stopped', stoppedAt: new Date().toISOString() });
  process.exit(failure ? 1 : 0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  for (const name of state.apps) {
    const output = fs.openSync(path.join(QA_DIR, `${name}.log`), 'a', 0o600);
    const child = spawn('pnpm', ['--filter', `@school/${name}`, 'exec', 'next', 'dev', '--webpack', '--port', String(APPS[name].port), '--hostname', '127.0.0.1'], {
      cwd: ROOT, env: appEnvironment(profile), detached: true, stdio: ['ignore', output, output],
    });
    fs.closeSync(output);
    children.push(child);
    child.on('error', () => { failure = true; void shutdown(); });
    child.on('exit', () => { if (!stopping) { failure = true; void shutdown(); } });
  }
  const deadline = Date.now() + 180_000;
  const pending = new Set(state.apps);
  while (pending.size && !stopping && Date.now() < deadline) {
    await Promise.all([...pending].map(async name => {
      try {
        const response = await fetch(`http://localhost:${APPS[name].port}${APPS[name].readiness}`, { signal: AbortSignal.timeout(5_000), redirect: 'manual' });
        if (response.status === 200) pending.delete(name);
      } catch { /* Still compiling or not listening. */ }
    }));
    if (pending.size) await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  if (stopping) { /* Shutdown owns the remaining work. */ }
  else if (pending.size) { failure = true; await shutdown(); }
  else {
    state = { ...state, status: 'ready', readyAt: new Date().toISOString() };
    writeJson(stateFile, state);
    // Signal handlers and child handles keep the owner alive until qa:stop.
  }
} catch {
  failure = true;
  await shutdown();
}
