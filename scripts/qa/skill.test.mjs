import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './core.mjs';

const folder = path.join(ROOT, '.agents/skills/verify-melo');
test('project verification skill has actionable versioned frontmatter and an AGENTS pointer', () => {
  const text = fs.readFileSync(path.join(folder, 'SKILL.md'), 'utf8');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(front);
  for (const key of ['name', 'description', 'author', 'coauthored', 'version']) assert.match(front[1], new RegExp(`^${key}: .+`, 'm'));
  assert.match(front[1], /^name: verify-melo$/m);
  assert.match(front[1], /^description: Use when /m);
  assert.match(front[1], /^version: \d+\.\d+\.\d+$/m);
  const description = front[1].match(/^description: (.+)$/m)[1];
  assert.ok((description.match(/[.!?](?:\s|$)/g) ?? []).length <= 2);
  assert.ok(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8').includes('.agents/skills/verify-melo/SKILL.md'));
});
test('all skill-local documentation links resolve and feature maps have the expected hierarchy', () => {
  const files = [path.join(folder, 'SKILL.md'), path.join(folder, 'references/exploration.md'), ...fs.readdirSync(path.join(folder, 'features')).map(name => path.join(folder, 'features', name))];
  for (const filename of files) {
    const text = fs.readFileSync(filename, 'utf8');
    for (const [, href] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(href)) continue;
      const target = path.resolve(path.dirname(filename), href.split('#')[0]);
      assert.ok(fs.existsSync(target), `${path.relative(ROOT, filename)} links to missing ${href}`);
    }
    if (path.basename(path.dirname(filename)) === 'features' && path.basename(filename) !== 'README.md') {
      assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map(match => match[1]), ['Sub-features', 'How to get to it (user POV)', 'Driving it with qa', 'Gotchas']);
    }
  }
});
