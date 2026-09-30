import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './core.mjs';
import { ROLES, parseRoles } from './browser-harness.mjs';

export function explorationScript(filename, root = ROOT) {
  if (!filename) throw new Error('qa:explore requires --script <worktree-contained .mjs module>.');
  const absolute = fs.realpathSync(path.resolve(root, filename));
  if (!absolute.startsWith(`${fs.realpathSync(root).replace(/\/$/, '')}${path.sep}`) || path.extname(absolute) !== '.mjs' || !fs.lstatSync(absolute).isFile()) {
    throw new Error('Exploration module must be a regular .mjs file inside this worktree; outside symlinks are refused.');
  }
  if (fs.statSync(absolute).size > 256_000) throw new Error('Keep exploratory modules under 256KB.');
  return { filename: absolute, sha256: createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') };
}
export function workflowRequirements(mode, opts) {
  if (mode === 'roles') {
    const roles = parseRoles(opts['--roles']);
    return { roles, apps: [...new Set(roles.flatMap(role => role === 'teacher' ? ['teacher', 'admin'] : [ROLES[role].app]))] };
  }
  if (mode === 'explore') {
    const roles = parseRoles(opts['--role'] ?? 'admin');
    if (roles.length !== 1) throw new Error('qa:explore uses exactly one --role.');
    return { role: roles[0], apps: [ROLES[roles[0]].app], script: explorationScript(opts['--script']), allowSyntheticWrites: opts.allowWrites === true };
  }
  return { apps: ['admin'] };
}
