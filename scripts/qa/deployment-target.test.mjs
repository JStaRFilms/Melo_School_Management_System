import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validateDeploymentProfile, attestDeploymentCredential, readDeploymentProfile } from './deployment-target.mjs';
import { TARGET } from './core.mjs';

const key = `dev:content-poodle-172|${'test-only-not-a-credential'.repeat(2)}`;
test('maintenance refuses selectors and credentials for every other target', () => {
  assert.equal(validateDeploymentProfile({ CONVEX_DEPLOY_KEY: key }), key);
  for (const values of [
    {}, { CONVEX_DEPLOYMENT: TARGET.deployment },
    { CONVEX_DEPLOY_KEY: 'global-login-token-without-prefix' },
    { CONVEX_DEPLOY_KEY: key.replace('dev:', 'prod:') },
    { CONVEX_DEPLOY_KEY: key.replace('content-poodle-172', 'scrupulous-chinchilla-25') },
    { CONVEX_DEPLOY_KEY: key, CONVEX_DEPLOYMENT: TARGET.deployment },
    { CONVEX_DEPLOY_KEY: key, CONVEX_SELF_HOSTED_URL: TARGET.cloudUrl },
    { CONVEX_DEPLOY_KEY: `${key}\nother` },
  ]) assert.throws(() => validateDeploymentProfile(values), /deployment-specific/);
});
test('profile reader refuses syntax differences, duplicates, and ignored assignments', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'melo-qa-deployment-profile-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'profile.env');
  fs.writeFileSync(filename, `# approved maintenance profile\n\nexport CONVEX_DEPLOY_KEY=${key}\n`, { mode: 0o600 });
  assert.equal(readDeploymentProfile(filename).key, key);
  for (const suffix of [
    'CONVEX_DEPLOY_KEY: prod:other-backend|different-token',
    'CONVEX_SELF_HOSTED_URL: https://other.convex.cloud',
    'lowercase_setting=ignored-by-qa-parser',
    'OTHER-SETTING=ignored-by-qa-parser',
    `CONVEX_DEPLOY_KEY=${key}`,
    'unrecognized non-comment text',
  ]) {
    fs.writeFileSync(filename, `CONVEX_DEPLOY_KEY=${key}\n${suffix}\n`);
    assert.throws(() => readDeploymentProfile(filename), /exactly one literal/);
  }
  fs.writeFileSync(filename, `CONVEX_DEPLOY_KEY="${key}"\n`);
  assert.throws(() => readDeploymentProfile(filename), /exactly one literal/);
});
test('effective credential must succeed on isolated target and be denied on normal dev', async () => {
  const calls = [];
  const proof = await attestDeploymentCredential(key, async (url, options) => {
    calls.push({ url, options });
    return { status: calls.length === 1 ? 200 : 401 };
  });
  assert.equal(proof.normalDevelopmentDenied, true);
  assert.equal(proof.cloudUrl, TARGET.cloudUrl);
  assert.equal(calls[0].url, `${TARGET.cloudUrl}/api/get_config_hashes`);
  assert.equal(calls[1].url, 'https://scrupulous-chinchilla-25.eu-west-1.convex.cloud/api/get_config_hashes');
  assert.ok(calls.every(call => call.options.redirect === 'error'));
  assert.ok(!JSON.stringify(proof).includes(key));
});
test('broad or expired credentials cannot authorize a push', async () => {
  await assert.rejects(attestDeploymentCredential(key, async () => ({ status: 200 })), /not denied/);
  await assert.rejects(attestDeploymentCredential(key, async () => ({ status: 401 })), /not valid/);
  let call = 0;
  await assert.rejects(attestDeploymentCredential(key, async () => ({ status: ++call === 1 ? 200 : 503 })), /not denied/);
});
