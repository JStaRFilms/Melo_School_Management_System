import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { InfisicalSDK } from '@infisical/sdk';

export const apps = ['www', 'teacher', 'admin', 'portal', 'apply', 'sites', 'platform'];
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const envFiles = ['.env.development.local', '.env.local', '.env.development', '.env'];

function readEnv(path) {
  return parseEnv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

export function prepareAppEnvironment(app, secrets, parentEnv, rootEnv) {
  if (!rootEnv.CONVEX_DEPLOYMENT?.startsWith('dev:') || !rootEnv.CONVEX_URL) {
    throw new Error('Root .env.local must select the existing development Convex deployment.');
  }
  const values = Object.fromEntries(secrets.map(({ secretKey, secretValue }) => [secretKey, secretValue]));
  const required = app === 'sites' ? [] : ['NEXT_PUBLIC_CONVEX_URL'];
  if (!['www', 'sites'].includes(app)) required.push('NEXT_PUBLIC_CONVEX_SITE_URL', 'BETTER_AUTH_SECRET');
  if (required.some((key) => !values[key]?.trim())) {
    throw new Error(`Incomplete Infisical dev /vercel-${app} configuration.`);
  }
  for (const key of ['CONVEX_URL', 'NEXT_PUBLIC_CONVEX_URL']) {
    if (values[key] && values[key] !== rootEnv.CONVEX_URL) {
      throw new Error(`Infisical dev /vercel-${app} ${key} does not match the root development target.`);
    }
  }
  for (const key of ['CONVEX_SITE_URL', 'NEXT_PUBLIC_CONVEX_SITE_URL']) {
    if (values[key] && values[key] !== rootEnv.CONVEX_SITE_URL) {
      throw new Error(`Infisical dev /vercel-${app} ${key} does not match the root development target.`);
    }
  }
  const env = { ...parentEnv, ...values };
  // Bootstrap credentials belong to this launcher, not the Next.js process.
  for (const key of Object.keys(env)) {
    if (key.startsWith('INFISICAL_')) delete env[key];
  }
  return env;
}

export async function loadAppEnvironment(app, { root = repoRoot, env = process.env, client } = {}) {
  if (!apps.includes(app)) throw new Error('Choose one of: ' + apps.join(', '));
  const bootstrapPath = resolve(root, '.env.infisical.local');
  const bootstrap = { ...(existsSync(bootstrapPath) ? readEnv(bootstrapPath) : {}), ...env };
  if (['INFISICAL_CLIENT_ID', 'INFISICAL_CLIENT_SECRET', 'INFISICAL_PROJECT_ID'].some((key) => !bootstrap[key])) {
    throw new Error('Set Infisical credentials in .env.infisical.local or the shell. See README.md.');
  }
  const rootEnv = readEnv(resolve(root, '.env.local'));
  const sdk = client ?? new InfisicalSDK({ siteUrl: 'https://app.infisical.com' });
  let secrets;
  try {
    await sdk.auth().universalAuth.login({
      clientId: bootstrap.INFISICAL_CLIENT_ID,
      clientSecret: bootstrap.INFISICAL_CLIENT_SECRET,
    });
    ({ secrets } = await sdk.secrets().listSecrets({
      projectId: bootstrap.INFISICAL_PROJECT_ID,
      environment: 'dev',
      secretPath: `/vercel-${app}`,
      includeImports: false,
      viewSecretValue: true,
    }));
  } catch {
    // SDK errors may contain response bodies. Do not log credentials or values.
    throw new Error(`Cannot fetch Infisical dev /vercel-${app}. Check connectivity and identity access. No local fallback was used.`);
  }
  return prepareAppEnvironment(app, secrets, env, rootEnv);
}

async function main() {
  const [app, ...args] = process.argv.slice(2);
  const check = args.length === 1 && args[0] === '--check';
  const env = await loadAppEnvironment(app);
  if (check) {
    console.log(`OK Infisical dev /vercel-${app}; development target matches; values not printed.`);
    return;
  }
  const cwd = resolve(repoRoot, 'apps', app);
  // Next loads absent values from dotenv files. Refuse that implicit second source.
  if (envFiles.some((name) => existsSync(resolve(cwd, name)))) {
    throw new Error(`Archive apps/${app}/.env* development files before using Infisical, or use dev:local. See README.md.`);
  }
  const require = createRequire(resolve(cwd, 'package.json'));
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('error', () => {
    console.error('Could not start the Next.js development process.');
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
