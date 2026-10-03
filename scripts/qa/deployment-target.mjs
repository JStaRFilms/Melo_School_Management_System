import fs from 'node:fs';
import { parseEnv, TARGET } from './core.mjs';

// Maintenance-only helpers. Ordinary qa:start/smoke/feature never deploy.
export function validateDeploymentProfile(values) {
  const key = values.CONVEX_DEPLOY_KEY;
  if (Object.keys(values).length !== 1 || typeof key !== 'string' ||
      !key.startsWith('dev:content-poodle-172|') ||
      key.split('|').length !== 2 || key.split('|')[1].length < 20 || /[\s\r\n]/.test(key)) {
    throw new Error('Maintenance requires only a deployment-specific dev:content-poodle-172 key. Project selectors, global login tokens, production keys, and URL overrides are refused.');
  }
  return key;
}

export function readDeploymentProfile(filename) {
  const absolute = fs.realpathSync(filename);
  const text = fs.readFileSync(absolute, 'utf8');
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  // Convex uses dotenv, which accepts syntax the general QA parser ignores,
  // including colon assignments. Accept one literal assignment only so the
  // same file cannot mean different targets to our gate and to the CLI.
  if (lines.length !== 1 || !/^(?:export\s+)?CONVEX_DEPLOY_KEY\s*=\s*dev:content-poodle-172\|[A-Za-z0-9_.=-]+$/.test(lines[0])) {
    throw new Error('Maintenance profile must contain exactly one literal CONVEX_DEPLOY_KEY assignment, plus optional blank/comment lines.');
  }
  const values = parseEnv(text);
  return { filename: absolute, key: validateDeploymentProfile(values) };
}

export function stagedIndexReady(index, name, fields) {
  if (!index || index.name !== name || index.staged !== true || !['backfilled', 'done'].includes(index.backfill?.state) || !Array.isArray(index.fields)) return false;
  // Convex metadata appends its implicit ordering field to declared fields.
  const actual = index.fields.at(-1) === '_creationTime' ? index.fields.slice(0, -1) : index.fields;
  return actual.length === fields.length && actual.every((field, position) => field === fields[position]);
}

export async function attestDeploymentCredential(key, request = fetch) {
  validateDeploymentProfile({ CONVEX_DEPLOY_KEY: key });
  async function metadata(url) {
    return request(`${url}/api/get_config_hashes`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Convex ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '1.34.1', adminKey: key }),
    });
  }
  const own = await metadata(TARGET.cloudUrl);
  if (own.status !== 200) throw new Error('Isolated deployment credential is not valid. No push authorized.');
  const other = await metadata('https://scrupulous-chinchilla-25.eu-west-1.convex.cloud');
  if (other.status !== 401 && other.status !== 403) throw new Error('Credential scope was not denied on normal development. No push authorized.');
  // Metadata stays private. No credential is returned or printed in the proof.
  return { cloudUrl: TARGET.cloudUrl, deployment: TARGET.deployment, isolatedAccessVerified: true, normalDevelopmentDenied: true };
}
