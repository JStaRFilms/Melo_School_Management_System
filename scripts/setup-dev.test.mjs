import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { archiveCandidates, developmentTarget } from './setup-dev.mjs';

test('derive a local development selector only from matching hosted URLs', () => {
  assert.deepEqual(developmentTarget({
    NEXT_PUBLIC_CONVEX_URL: 'https://synthetic.convex.cloud',
    NEXT_PUBLIC_CONVEX_SITE_URL: 'https://synthetic.convex.site',
  }), {
    CONVEX_DEPLOYMENT: 'dev:synthetic', CONVEX_URL: 'https://synthetic.convex.cloud', CONVEX_SITE_URL: 'https://synthetic.convex.site',
  });
  assert.equal(developmentTarget({
    NEXT_PUBLIC_CONVEX_URL: 'https://synthetic.eu-west-1.convex.cloud',
    NEXT_PUBLIC_CONVEX_SITE_URL: 'https://synthetic.eu-west-1.convex.site',
  }).CONVEX_DEPLOYMENT, 'dev:synthetic');
  for (const cloud of ['http://synthetic.convex.cloud', 'https://synthetic.convex.cloud.evil.test', 'https://user:secret@synthetic.convex.cloud']) {
    assert.throws(() => developmentTarget({ NEXT_PUBLIC_CONVEX_URL: cloud, NEXT_PUBLIC_CONVEX_SITE_URL: 'https://synthetic.convex.site' }));
  }
  assert.throws(() => developmentTarget({ NEXT_PUBLIC_CONVEX_URL: 'https://synthetic.convex.cloud', NEXT_PUBLIC_CONVEX_SITE_URL: 'https://different.convex.site' }));
});

test('archive preflight handles BOMs, rejects differing values and makes no changes', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'melo-setup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'apps/admin'), { recursive: true });
  const path = join(root, 'apps/admin/.env.local');
  writeFileSync(path, '\uFEFFSITE_URL="http://localhost:3102"\n');
  const bytes = readFileSync(path);
  assert.deepEqual(archiveCandidates(root, { admin: { SITE_URL: 'http://localhost:3102' } }), ['apps/admin/.env.local']);
  assert.throws(() => archiveCandidates(root, { admin: { SITE_URL: 'http://different.invalid' } }), /Nothing was archived/);
  assert.ok(existsSync(path));
  assert.deepEqual(readFileSync(path), bytes);
});
