import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadAppEnvironment, prepareAppEnvironment } from './infisical-dev.mjs';

const rootEnv = {
  CONVEX_DEPLOYMENT: 'dev:synthetic',
  CONVEX_URL: 'https://synthetic.convex.cloud',
  CONVEX_SITE_URL: 'https://synthetic.convex.site',
};
const values = {
  NEXT_PUBLIC_CONVEX_URL: rootEnv.CONVEX_URL,
  NEXT_PUBLIC_CONVEX_SITE_URL: rootEnv.CONVEX_SITE_URL,
  BETTER_AUTH_SECRET: 'synthetic-auth',
  SITE_URL: 'http://localhost:3102',
};
const secrets = Object.entries(values).map(([secretKey, secretValue]) => ({ secretKey, secretValue }));

test('Infisical wins over shell values and bootstrap credentials never reach Next', () => {
  const env = prepareAppEnvironment('admin', secrets, {
    PATH: 'synthetic-path',
    SITE_URL: 'http://stale.invalid',
    INFISICAL_CLIENT_SECRET: 'synthetic-bootstrap',
    INFISICAL_CLIENT_ID: 'synthetic-id',
    INFISICAL_PROJECT_ID: 'synthetic-project',
  }, rootEnv);
  assert.equal(env.SITE_URL, values.SITE_URL);
  assert.equal(env.PATH, 'synthetic-path');
  assert.equal(env.BETTER_AUTH_SECRET, values.BETTER_AUTH_SECRET);
  assert.equal(Object.keys(env).some((key) => key.startsWith('INFISICAL_')), false);
});

test('reject production selectors, missing required secrets and mismatched targets', () => {
  assert.throws(() => prepareAppEnvironment('admin', secrets, {}, {
    ...rootEnv, CONVEX_DEPLOYMENT: 'prod:synthetic',
  }), /development Convex deployment/);
  assert.throws(() => prepareAppEnvironment('apply', [], values, rootEnv), /Incomplete/);
  assert.throws(() => prepareAppEnvironment('admin', [
    ...secrets.filter(({ secretKey }) => secretKey !== 'NEXT_PUBLIC_CONVEX_URL'),
    { secretKey: 'NEXT_PUBLIC_CONVEX_URL', secretValue: 'https://wrong.convex.cloud' },
  ], {}, rootEnv), /does not match/);
  assert.throws(() => prepareAppEnvironment('admin', [
    ...secrets, { secretKey: 'CONVEX_SITE_URL', secretValue: 'https://wrong.convex.site' },
  ], {}, rootEnv), /does not match/);
});

test('reads only the selected app folder in dev and redacts provider failures', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'melo-infisical-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, '.env.local'), '\uFEFF' + Object.entries(rootEnv).map(([k, v]) => `${k}=${v}`).join('\n'));
  writeFileSync(join(root, '.env.infisical.local'), [
    'INFISICAL_CLIENT_ID=synthetic-id',
    'INFISICAL_CLIENT_SECRET="synthetic-secret"',
    'INFISICAL_PROJECT_ID=synthetic-project',
  ].join('\n'));
  let login;
  let request;
  const client = {
    auth: () => ({ universalAuth: { login: async (options) => { login = options; } } }),
    secrets: () => ({ listSecrets: async (options) => {
      request = options;
      return { secrets };
    } }),
  };
  const env = await loadAppEnvironment('apply', { root, env: {}, client });
  assert.equal(login.clientSecret, 'synthetic-secret');
  assert.deepEqual(request, {
    projectId: 'synthetic-project', environment: 'dev', secretPath: '/vercel-apply',
    includeImports: false, viewSecretValue: true,
  });
  assert.equal(env.NEXT_PUBLIC_CONVEX_SITE_URL, rootEnv.CONVEX_SITE_URL);
  assert.equal(env.INFISICAL_CLIENT_SECRET, undefined);
  client.secrets = () => ({ listSecrets: async () => { throw new Error('secret-provider-body'); } });
  await assert.rejects(loadAppEnvironment('apply', { root, env: {}, client }), (error) => {
    assert.match(error.message, /No local fallback/);
    assert.doesNotMatch(error.message, /secret-provider-body/);
    return true;
  });
  await assert.rejects(loadAppEnvironment('../prod', { root, env: {}, client }), /Choose one/);
});
