import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { ROOT, QA_DIR, APPS, readJson, writeJson, loadProfile, appEnvironment, releaseLease, resolvePnpmCommand, supervisorStopFile } from './core.mjs';

const id = process.argv[3];
const stateFile = path.join(QA_DIR, 'state.json');
let state = readJson(stateFile);
if (process.argv[2] !== '--id' || state.id !== id) throw new Error('Supervisor owner mismatch.');
const profile = loadProfile(state.profile);
const stopFile = supervisorStopFile(id);
const children = [];
let stopping = false;
let failure = false;
state.pid = process.pid;
writeJson(stateFile, state);

const stopPoller = process.platform === 'win32'
  ? setInterval(() => {
    if (fs.existsSync(stopFile)) {
      try { fs.unlinkSync(stopFile); } catch { /* Already removed. */ }
      void shutdown();
    }
  }, 200)
  : null;

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (stopPoller) clearInterval(stopPoller);
  try { if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile); } catch { /* Already removed. */ }
  try {
    state = { ...state, status: 'stopping' };
    if (readJson(stateFile).id === id) writeJson(stateFile, state);
  } catch { failure = true; }
  let childrenStopped = true;
  try {
    if (process.platform === 'win32') {
      for (const child of children) {
        if (child.exitCode === null && child.signalCode === null && Number.isInteger(child.pid)) {
          try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); }
          catch { /* Verify whether the child actually exited below. */ }
          const deadline = Date.now() + 2_000;
          while (child.exitCode === null && child.signalCode === null && isProcessAlive(child.pid) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (child.exitCode === null && child.signalCode === null && isProcessAlive(child.pid)) {
            childrenStopped = false;
            failure = true;
          }
        }
      }
    } else {
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
    }
  } catch { childrenStopped = false; failure = true; }
  finally {
    if (childrenStopped) {
      for (const lease of state.leases) {
        try { releaseLease(lease, id); } catch { failure = true; }
      }
    }
    try {
      if (readJson(stateFile).id === id) writeJson(stateFile, { ...state, status: failure ? 'failed' : 'stopped', stoppedAt: new Date().toISOString() });
    } catch { failure = true; }
    process.exit(failure ? 1 : 0);
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

try {
  for (const name of state.apps) {
    const output = fs.openSync(path.join(QA_DIR, `${name}.log`), 'a', 0o600);
    const pnpm = resolvePnpmCommand(['--filter', `@school/${name}`, 'exec', 'next', 'dev', '--webpack', '--port', String(APPS[name].port), '--hostname', '127.0.0.1']);
    if (!pnpm) throw new Error('Install pnpm before running QA.');
    const child = spawn(pnpm.command, pnpm.args, {
      cwd: ROOT,
      env: appEnvironment(profile),
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', output, output],
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
