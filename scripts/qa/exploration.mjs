import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
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
export function readDeclaredEffects(filename) {
  const text = fs.readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const declarations = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'effects' && declaration.initializer && ts.isStringLiteral(declaration.initializer)) declarations.push(declaration.initializer.text);
    }
  }
  if (declarations.length !== 1 || !['read-only', 'synthetic-writes'].includes(declarations[0])) throw new Error('Exploration must declare exactly one literal read-only or synthetic-writes effect before module import.');
  return declarations[0];
}
export function validateDeclaredModulePermission(effects, { allowTrustedModule = false, allowSyntheticWrites = false } = {}) {
  if (!allowTrustedModule) throw new Error('Agent-authored modules execute trusted Node.js code. Inspect the module and pass --run-trusted-module before importing it.');
  if (effects === 'synthetic-writes' && !allowSyntheticWrites) throw new Error('Synthetic-write module refused before import. Pass --allow-synthetic-writes only after reviewing its UI scope.');
  return true;
}
export function workflowRequirements(mode, opts) {
  if (mode === 'roles') {
    const roles = parseRoles(opts['--roles']);
    return { roles, apps: [...new Set(roles.flatMap(role => role === 'teacher' ? ['teacher', 'admin'] : [ROLES[role].app]))] };
  }
  if (mode === 'workflow') return { apps: ['admin', 'teacher', 'portal'], script: explorationScript(opts['--script']), allowSyntheticWrites: opts.allowWrites === true, allowTrustedModule: opts.allowTrustedModule === true };
  if (mode === 'explore') {
    const roles = parseRoles(opts['--role'] ?? 'admin');
    if (roles.length !== 1) throw new Error('qa:explore uses exactly one --role.');
    return { role: roles[0], apps: [ROLES[roles[0]].app], script: explorationScript(opts['--script']), allowSyntheticWrites: opts.allowWrites === true, allowTrustedModule: opts.allowTrustedModule === true };
  }
  return { apps: ['admin'] };
}
