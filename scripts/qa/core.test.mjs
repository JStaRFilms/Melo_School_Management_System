import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {
  TARGET, ROOT, parseEnv, assertTarget, parseApps, assertAppTargets, portAvailable,
  acquireLease, releaseLease, withLease, ownsSupervisor, appEnvironment, escapeHtml, evidenceStatus, isBackendContractBlocker,
} from './core.mjs';
import { options, validateOptions } from './cli.mjs';
import { reportHtml } from './report.mjs';

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'melo-qa-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function profile() {
  return {
    CONVEX_DEPLOYMENT: TARGET.deployment, DEMO_SEED_EXPECTED_CLOUD_URL: TARGET.cloudUrl,
    DEMO_SEED_OPERATOR_TOKEN: 'private-test-token', DEMO_SEED_DEPLOYMENT_IDENTITY: 'private-test-identity',
    DEMO_SEED_DEPLOYMENT_ENV: 'development',
  };
}

test('profile parsing preserves quoted hashes and strips CLI target comments', () => {
  assert.deepEqual(parseEnv('CONVEX_DEPLOYMENT=dev:content-poodle-172 # team details\nTOKEN="a#b=c" # private\nexport URL=hello\nIGNORED\n'), {
    CONVEX_DEPLOYMENT: TARGET.deployment, TOKEN: 'a#b=c', URL: 'hello',
  });
  assert.throws(() => parseEnv('TOKEN="unterminated'), /Invalid quoted/);
  assert.throws(() => parseEnv('TOKEN="value" garbage'), /Invalid quoted/);
});
test('only the approved development target is accepted, never production or normal dev', () => {
  assert.doesNotThrow(() => assertTarget(profile(), 'profile', true));
  for (const deployment of ['prod:content-poodle-172', 'dev:scrupulous-chinchilla-25', 'preview:branch', '']) {
    assert.throws(() => assertTarget({ ...profile(), CONVEX_DEPLOYMENT: deployment }, 'profile', true), /does not match/);
  }
  for (const key of ['CONVEX_URL', 'NEXT_PUBLIC_CONVEX_URL', 'NEXT_PUBLIC_CONVEX_SITE_URL']) {
    assert.throws(() => assertTarget({ ...profile(), [key]: 'https://unapproved.convex.cloud' }, 'profile', true), /does not match/);
  }
});
test('operator gate is necessary for inspection but errors never reveal its value', () => {
  const values = { ...profile(), DEMO_SEED_DEPLOYMENT_ENV: 'production' };
  assert.throws(() => assertTarget(values, 'profile', true), error => !error.message.includes(values.DEMO_SEED_OPERATOR_TOKEN));
  assert.throws(() => assertTarget({}, 'profile', true), /required/);
});
test('app selection refuses unattested apps, duplicates, and extra arguments', () => {
  assert.deepEqual(parseApps('admin,teacher,portal'), ['admin', 'teacher', 'portal']);
  for (const value of ['admin,admin', 'platform', '', 'admin,', '__proto__']) assert.throws(() => parseApps(value));
  assert.deepEqual(options(['--apps', 'admin', '--publish-reviewed']), { '--apps': 'admin', publish: true });
  for (const value of [['--reset'], ['--apps'], ['--apps', '--run'], ['--apps', 'admin', '--apps', 'teacher']]) assert.throws(() => options(value));
  assert.throws(() => validateOptions('smoke', { '--apps': 'admin' }), /Unsupported/);
  assert.throws(() => validateOptions('start', { publish: true }), /Unsupported/);
  assert.doesNotThrow(() => validateOptions('report', { publish: true }));
});
test('root and app target mismatches are refused instead of overwritten', t => {
  const root = temporary(t);
  fs.mkdirSync(path.join(root, 'apps/admin'), { recursive: true });
  assert.doesNotThrow(() => assertAppTargets(['admin'], root));
  fs.writeFileSync(path.join(root, 'apps/admin/.env.local'), 'NEXT_PUBLIC_CONVEX_URL=https://scrupulous-chinchilla-25.eu-west-1.convex.cloud');
  assert.throws(() => assertAppTargets(['admin'], root), /does not match/);
});
test('occupied ports are detected without killing a process', async t => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '::', resolve));
  t.after(() => server.close());
  assert.equal(await portAvailable(server.address().port), false);
});
test('leases are exclusive and can only be released by their owner', t => {
  const directory = temporary(t);
  const filename = acquireLease('port-3102', { id: 'qa-first' }, directory);
  assert.throws(() => acquireLease('port-3102', { id: 'qa-second' }, directory), /already reserved/);
  assert.throws(() => releaseLease(filename, 'qa-second'), /another run/);
  assert.equal(fs.existsSync(filename), true);
  releaseLease(filename, 'qa-first');
  assert.equal(fs.existsSync(filename), false);
  assert.throws(() => acquireLease('../escape', { id: 'qa-first' }, directory), /Invalid/);
});
test('setup or metadata failures release the backend lease', async t => {
  const directory = temporary(t);
  await assert.rejects(withLease('backend-test', { id: 'qa-setup' }, async () => { throw new Error('Directory or revision setup failed'); }, directory), /setup failed/);
  assert.deepEqual(fs.readdirSync(directory), []);
  assert.equal(await withLease('backend-test', { id: 'qa-success' }, async () => 42, directory), 42);
  assert.deepEqual(fs.readdirSync(directory), []);
});
test('supervisor ownership requires exact script and run token', () => {
  const state = { id: 'qa-first', pid: 1234 };
  const command = `node ${ROOT}scripts/qa/supervisor.mjs --id qa-first`;
  assert.equal(ownsSupervisor(state, command), true);
  assert.equal(ownsSupervisor(state, `${command}-other`), false);
  assert.equal(ownsSupervisor(state, 'node unrelated-app.mjs'), false);
  assert.equal(ownsSupervisor({ ...state, pid: 1 }, command), false);
});
test('operator profile secrets are not inherited by frontend apps', () => {
  const env = appEnvironment({ values: profile() });
  assert.equal(env.NEXT_PUBLIC_CONVEX_URL, TARGET.cloudUrl);
  assert.equal(env.NEXT_PUBLIC_CONVEX_SITE_URL, TARGET.siteUrl);
  assert.equal(env.DEMO_SEED_OPERATOR_TOKEN, undefined);
  assert.equal(env.DEMO_SEED_DEPLOYMENT_IDENTITY, undefined);
  assert.equal(env.CONVEX_DEPLOY_KEY, undefined);
  assert.equal(env.CONVEX_SELF_HOSTED_ADMIN_KEY, undefined);
});
test('skipped, blocked, and empty checks cannot become a passing report', () => {
  assert.equal(evidenceStatus([]), 'blocked');
  assert.equal(evidenceStatus([{ status: 'passed' }, { status: 'skipped' }]), 'blocked');
  assert.equal(evidenceStatus([{ status: 'failed' }, { status: 'blocked' }]), 'failed');
  assert.equal(evidenceStatus([{ status: 'passed' }]), 'passed');
  assert.throws(() => evidenceStatus([{ status: 'unknown' }]));
});
test('known deployed template validator drift is a blocker, not a hidden pass', () => {
  assert.equal(isBackendContractBlocker(['ArgumentValidationError: Object contains extra field `formatHint`']), true);
  assert.equal(isBackendContractBlocker(['User is unauthorized']), false);
  assert.equal(isBackendContractBlocker(['ArgumentValidationError: missing required field']), false);
});
test('HTML report escapes content and refuses unsafe evidence names', () => {
  const run = { id: 'qa-test', mode: 'feature', status: 'blocked', deployment: TARGET.deployment, scope: '<script>alert(1)</script>', checks: [{ name: '<img onerror=oops>', status: 'blocked' }], screenshots: ['desktop.png'] };
  const html = reportHtml(run);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<img onerror=oops>'));
  assert.ok(html.includes('1 blocked'));
  assert.throws(() => reportHtml({ ...run, screenshots: ['../secret.png'] }), /Unsafe/);
  assert.throws(() => reportHtml({ ...run, status: 'unknown' }), /Invalid/);
  assert.throws(() => reportHtml({ ...run, status: 'passed' }), /disagrees/);
  assert.equal(escapeHtml('"&<>'), '&quot;&amp;&lt;&gt;');
});
