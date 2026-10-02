import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserHarness, parseRoles, validateExploration, allowedBrowserUrl, validateWorkflow } from './browser-harness.mjs';
import { workflowRequirements, explorationScript } from './exploration.mjs';
import { TARGET, evidenceStatus, workspaceRevision } from './core.mjs';
import { validateOptions } from './cli.mjs';
import { reportHtml } from './report.mjs';
import { roleJourneys } from './role-journeys.mjs';

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'melo-qa-browser-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
test('roles map to owned apps and teacher denial also requires Admin', () => {
  assert.deepEqual(parseRoles('teacher,parent'), ['teacher', 'parent']);
  for (const value of ['', 'admin,admin', 'platform', '__proto__']) assert.throws(() => parseRoles(value));
  assert.deepEqual(workflowRequirements('roles', { '--roles': 'teacher' }).apps, ['teacher', 'admin']);
  assert.throws(() => validateOptions('roles', { '--script': 'script.mjs' }));
  assert.doesNotThrow(() => validateOptions('explore', { '--role': 'parent', '--script': 'script.mjs' }));
});
test('exploratory module has a concrete scope and nonempty, unique acceptance steps', () => {
  const module = { scope: 'Test an observed user workflow', effects: 'read-only', steps: [{ name: 'Persist after reload', run: async () => {} }] };
  assert.doesNotThrow(() => validateExploration(module));
  for (const invalid of [{ ...module, scope: '' }, { ...module, effects: 'external-provider' }, { ...module, steps: [] }, { ...module, steps: [{ name: 'No executable check' }] }, { ...module, steps: [...module.steps, ...module.steps] }]) assert.throws(() => validateExploration(invalid));
});
test('exploration paths cannot escape through a sibling or symlink', t => {
  const parent = temporary(t);
  const root = path.join(parent, 'project');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'check.mjs'), 'export const scope="test";');
  fs.writeFileSync(path.join(parent, 'outside.mjs'), 'export const scope="outside";');
  fs.symlinkSync(path.join(parent, 'outside.mjs'), path.join(root, 'link.mjs'));
  const script = explorationScript('check.mjs', root);
  assert.equal(script.sha256.length, 64);
  assert.throws(() => explorationScript('../outside.mjs', root), /inside this worktree/);
  assert.throws(() => explorationScript('link.mjs', root), /inside this worktree/);
});
test('browser requests are confined to owned app origins and the isolated Convex host', () => {
  for (const url of [TARGET.cloudUrl, TARGET.siteUrl, 'http://localhost:3102/sign-in', 'ws://localhost:3102/_next/webpack-hmr', TARGET.cloudUrl.replace('https:', 'wss:') + '/api/sync', 'about:blank']) assert.equal(allowedBrowserUrl(url, ['admin']), true);
  for (const url of ['https://scrupulous-chinchilla-25.eu-west-1.convex.cloud', 'http://localhost:3101', 'http://localhost:3002', 'https://third-party.example.test', 'http://secret@localhost:3102']) assert.equal(allowedBrowserUrl(url, ['admin']), false);
});
test('public font allowance cannot be used for scripts, XHR, or provider writes', () => {
  assert.equal(allowedBrowserUrl('https://fonts.googleapis.com/css2?family=Inter', ['admin'], { resourceType: 'stylesheet' }), true);
  assert.equal(allowedBrowserUrl('https://fonts.gstatic.com/s/inter/v18/font.woff2', ['admin'], { resourceType: 'font' }), true);
  assert.equal(allowedBrowserUrl('https://fonts.gstatic.com/l/font?kit=public-font-subset', ['admin'], { resourceType: 'font' }), true);
  assert.equal(allowedBrowserUrl('https://fonts.gstatic.com/l/font', ['admin'], { resourceType: 'fetch' }), false);
  assert.equal(allowedBrowserUrl('https://fonts.googleapis.com/css2', ['admin'], { resourceType: 'fetch' }), false);
  assert.equal(allowedBrowserUrl('https://fonts.googleapis.com/css2', ['admin'], { resourceType: 'stylesheet', method: 'POST' }), false);
  assert.equal(allowedBrowserUrl('https://fonts.gstatic.com/s/inter/code.js', ['admin'], { resourceType: 'script' }), false);
});
test('failed exploratory criteria block following checks rather than silently passing', async t => {
  const directory = temporary(t);
  const harness = new BrowserHarness(directory, { id: 'qa-test', mode: 'explore', deployment: TARGET.deployment }, {}, 'Test scope');
  const diagnostics = { role: 'parent', errors: [], consoleErrors: [], blockedRequests: 0 };
  harness.diagnostics.push(diagnostics);
  harness.actor = async () => ({ diagnostics, capture: async () => {}, context: { tracing: { stop: async () => {} }, close: async () => {} } });
  let laterRan = false;
  await harness.runSteps('parent', [
    { name: 'first observable criterion', run: async () => { throw new Error('Expected deliberate assertion failure'); } },
    { name: 'later criterion', run: async () => { laterRan = true; } },
  ]);
  assert.equal(laterRan, false);
  assert.equal(evidenceStatus(harness.result.checks), 'failed');
  assert.equal(harness.result.checks.find(row => row.name.includes('later criterion')).status, 'blocked');
});
test('interruption records every pending criterion including roles not yet started', t => {
  const harness = new BrowserHarness(temporary(t), { id: 'qa-interrupted', mode: 'roles' }, {}, 'Partial run');
  harness.declareSteps('admin', [{ name: 'admin criterion' }]);
  harness.declareSteps('parent', [{ name: 'parent criterion' }]);
  harness.record('admin: real fixture sign-in', 'passed');
  harness.blockPending('Interrupted before this criterion.');
  assert.equal(harness.result.checks.length, 6);
  assert.equal(harness.result.checks.find(check => check.name === 'parent: parent criterion').status, 'blocked');
  assert.equal(evidenceStatus(harness.result.checks), 'blocked');
  harness.blockPending();
  assert.equal(harness.result.checks.length, 6);
});
test('exploratory reports disclose declared effects without guaranteeing code side effects', () => {
  const html = reportHtml({ id: 'qa-effect', mode: 'explore', effects: 'read-only', deployment: TARGET.deployment, status: 'passed', scope: 'Observed criteria only', checks: [{ name: 'One criterion', status: 'passed' }], screenshots: [] });
  assert.ok(html.includes('Exploratory declared effects'));
  assert.ok(html.includes('not a security sandbox'));
  assert.ok(!html.includes('No seed, reset, purge, or production operation was invoked by this runner'));
});
test('topic detail proof waits for navigation and requires a detail H1 before capture', async () => {
  const origin = 'http://localhost:3103';
  let current = new URL('/learning/topics', origin);
  const events = [];
  const link = { filter: () => link, getAttribute: async () => '/learning/topics/test-topic', click: async () => { events.push('click'); } };
  const page = {
    getByRole: (role, opts) => role === 'link' ? link : { level: opts.level },
    waitForURL: async predicate => { events.push('wait-navigation'); current = new URL('/learning/topics/test-topic', origin); assert.ok(predicate(current)); },
    reload: async () => { events.push('reload'); },
  };
  const assertion = value => ({
    toBe: expected => assert.equal(value, expected),
    toMatch: pattern => assert.match(value, pattern),
    toBeVisible: async () => { assert.equal(value.level, 1); assert.equal(current.pathname, '/learning/topics/test-topic'); },
    toHaveURL: async predicate => assert.ok(predicate(current)),
  });
  await roleJourneys.parent.find(step => step.name.startsWith('topic detail')).run({ page, origin, expect: assertion, capture: async () => { events.push('capture'); assert.equal(current.pathname, '/learning/topics/test-topic'); } });
  assert.deepEqual(events, ['click', 'wait-navigation', 'capture', 'reload']);
});
test('workflow phases have ordered dependencies and unique role-phase criteria', async t => {
  const step = { name: 'observed state', run: async () => {} };
  const module = { scope: 'Real cross-role case', effects: 'synthetic-writes', phases: [{ id: 'setup', role: 'admin', steps: [step] }, { id: 'publish', role: 'admin', dependsOn: ['setup'], steps: [step] }, { id: 'cleanup', role: 'admin', alwaysRun: true, steps: [step] }] };
  assert.doesNotThrow(() => validateWorkflow(module));
  assert.throws(() => validateWorkflow({ ...module, phases: [{ ...module.phases[0], dependsOn: ['future'] }] }));
  const harness = new BrowserHarness(temporary(t), { id: 'qa-phases', mode: 'workflow' }, {}, 'Scope');
  harness.actor = async (role, phase) => ({ diagnostics: { role, phase, errors: [], consoleErrors: [], blockedRequests: 0 }, capture: async () => {}, context: { storageState: async () => ({}), tracing: { stop: async () => {} }, close: async () => {} } });
  assert.equal(await harness.runSteps('admin', [step], { phase: 'setup' }), true);
  assert.equal(await harness.runSteps('admin', [{ name: 'observed state', run: async () => { throw new Error('Deliberate later phase failure'); } }], { phase: 'publish' }), false);
  assert.equal(harness.result.checks.find(check => check.name === 'admin/setup: observed state').status, 'passed');
  assert.equal(harness.result.checks.find(check => check.name === 'admin/publish: observed state').status, 'failed');
});
test('reports identify the checkout and never infer a deployed backend revision', () => {
  const workspace = workspaceRevision();
  assert.match(workspace.checkoutRevision, /^[a-f0-9]{40}$/);
  assert.equal(workspace.backendCodeRevision, null);
  const html = reportHtml({ id: 'qa-version', mode: 'roles', deployment: TARGET.deployment, status: 'passed', scope: 'Recorded scope', checks: [{ name: 'Observed workflow', status: 'passed' }], screenshots: [], workspace });
  assert.ok(html.includes(workspace.checkoutRevision));
  assert.ok(html.includes('not a deployed source revision'));
});
