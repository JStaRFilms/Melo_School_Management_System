import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { InfisicalSDK } from '@infisical/sdk';
import { apps, loadAppEnvironment } from './infisical-dev.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const bootstrapKeys = ['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET', 'INFISICAL_PROJECT_ID'];
const envFiles = ['.env.local', '.env', '.env.development', '.env.development.local'];
const readEnv = (path) => parseEnv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));

export function developmentTarget(values) {
  const cloud = new URL(values.NEXT_PUBLIC_CONVEX_URL);
  const site = new URL(values.NEXT_PUBLIC_CONVEX_SITE_URL);
  if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.convex\.cloud\/?$/.test(cloud.href)
    || site.href !== cloud.href.replace('.convex.cloud', '.convex.site')) {
    throw new Error('Infisical dev must supply matching hosted Convex cloud and site URLs.');
  }
  return {
    CONVEX_DEPLOYMENT: `dev:${cloud.hostname.split('.')[0]}`,
    CONVEX_URL: cloud.origin,
    CONVEX_SITE_URL: site.origin,
  };
}

export function archiveCandidates(root, environments) {
  const files = [];
  for (const app of apps) {
    for (const name of envFiles) {
      const relative = `apps/${app}/${name}`;
      const source = resolve(root, relative);
      if (!existsSync(source)) continue;
      const old = readEnv(source);
      if (Object.entries(old).some(([key, value]) => environments[app][key] !== value)) {
        throw new Error(`${relative} differs from Infisical. Nothing was archived. Reconcile it privately first.`);
      }
      files.push(relative);
    }
  }
  return files;
}

export async function setupDev({ root = repoRoot, from, env = process.env } = {}) {
  const ignored = (relative) => {
    try {
      execFileSync('git', ['check-ignore', '--quiet', '--', relative], { cwd: root, stdio: 'pipe' });
    } catch {
      throw new Error(`${relative} must be git-ignored before setup can write it.`);
    }
  };
  const bootstrapPath = resolve(root, '.env.infisical.local');
  const rootPath = resolve(root, '.env.local');
  const source = from ? resolve(from) : root;
  const sourceBootstrap = resolve(source, '.env.infisical.local');
  const credentials = {
    ...(existsSync(sourceBootstrap) ? readEnv(sourceBootstrap) : {}),
    ...(existsSync(bootstrapPath) ? readEnv(bootstrapPath) : {}),
    ...env,
  };
  if (bootstrapKeys.some((key) => !credentials[key]?.trim())) {
    if (!existsSync(bootstrapPath)) {
      ignored('.env.infisical.local');
      writeFileSync(bootstrapPath, readFileSync(resolve(root, '.env.infisical.example')), { flag: 'wx', mode: 0o600 });
    }
    throw new Error('Fill .env.infisical.local privately with the three Infisical bootstrap fields, then rerun pnpm setup:dev.');
  }
  const client = new InfisicalSDK({ siteUrl: 'https://app.infisical.com' });
  let values;
  try {
    await client.auth().universalAuth.login({ clientId: credentials.INFISICAL_CLIENT_ID, clientSecret: credentials.INFISICAL_CLIENT_SECRET });
    const result = await client.secrets().listSecrets({
      projectId: credentials.INFISICAL_PROJECT_ID, environment: 'dev', secretPath: '/vercel-admin',
      includeImports: false, viewSecretValue: true,
    });
    values = Object.fromEntries(result.secrets.map(({ secretKey, secretValue }) => [secretKey, secretValue]));
  } catch {
    throw new Error('Cannot read Infisical dev configuration. Check bootstrap credentials and connectivity.');
  }
  const target = developmentTarget(values);
  // Never replace a different selector, including isolated QA and Preview profiles.
  if (existsSync(rootPath)) {
    const existing = readEnv(rootPath);
    if (Object.entries(target).some(([key, value]) => existing[key] !== value)) {
      throw new Error('Existing root .env.local selects a different target. It was not changed.');
    }
  }
  if (!existsSync(bootstrapPath)) {
    ignored('.env.infisical.local');
    writeFileSync(bootstrapPath, bootstrapKeys.map((key) => `${key}=${JSON.stringify(credentials[key])}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (!existsSync(rootPath)) {
    ignored('.env.local');
    writeFileSync(rootPath, Object.entries(target).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  const environments = {};
  for (const app of apps) environments[app] = await loadAppEnvironment(app, { root, env: credentials, client });
  const files = archiveCandidates(root, environments);
  for (const relative of files) ignored(relative);
  const archive = `tmp/local-env-archive/${new Date().toISOString().replace(/[:.]/g, '-')}`;
  for (const relative of files) {
    const destination = resolve(root, archive, relative);
    ignored(`${archive}/${relative}`);
    if (existsSync(destination)) throw new Error('Archive destination already exists.');
  }
  for (const relative of files) {
    const destination = resolve(root, archive, relative);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    renameSync(resolve(root, relative), destination);
  }
  console.log(`Verified all seven Infisical dev folders. Archived ${files.length} matching legacy files${files.length ? ` under ${archive}` : ''}.`);
  console.log('Ready for pnpm dev. No remote Convex or production configuration was changed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--from')) {
    console.error('Usage: pnpm setup:dev [--from <existing-development-checkout>]');
    process.exitCode = 1;
  } else {
    setupDev({ from: args[1] }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
