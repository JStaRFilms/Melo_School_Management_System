const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const DEMO_SLUG = "demo-school";

// Read only target keys. Never include their values in diagnostics.
function configuredValue(directory, key) {
  let value;
  for (const file of [".env", ".env.development", ".env.local", ".env.development.local"]) {
    const filename = path.join(directory, file);
    if (!fs.existsSync(filename)) continue;
    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match?.[1] === key) value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return value;
}

function requireTarget(env, appTarget = configuredValue) {
  const selector = env.CONVEX_DEPLOYMENT;
  if (!/^dev:[a-z0-9][a-z0-9-]*$/.test(selector ?? "")) {
    throw new Error("E2E requires an explicit CONVEX_DEPLOYMENT dev: selector; production and preview are refused.");
  }
  if (env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !env.DEMO_SEED_OPERATOR_TOKEN || !env.DEMO_SEED_DEPLOYMENT_IDENTITY) {
    throw new Error("E2E requires DEMO_SEED_DEPLOYMENT_ENV=development, DEMO_SEED_OPERATOR_TOKEN and DEMO_SEED_DEPLOYMENT_IDENTITY.");
  }
  const expected = env.DEMO_SEED_EXPECTED_CLOUD_URL;
  if (!expected || !/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(expected)) {
    throw new Error("E2E requires an explicit HTTPS DEMO_SEED_EXPECTED_CLOUD_URL on convex.cloud.");
  }
  const expectedSite = expected.replace(/\.convex\.cloud$/, ".convex.site");
  for (const key of ["CONVEX_DEPLOYMENT", "CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "DEMO_SEED_EXPECTED_CLOUD_URL", "CONVEX_SITE_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"]) {
    const local = appTarget(root, key);
    if (local !== undefined && local !== (key === "CONVEX_DEPLOYMENT" ? selector : key.endsWith("SITE_URL") ? expectedSite : expected)) {
      throw new Error(`Root ${key} target mismatch; E2E aborted before inspection.`);
    }
  }
  for (const key of ["CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "CONVEX_SITE_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"]) {
    if (env[key] !== undefined && env[key] !== (key.endsWith("SITE_URL") ? expectedSite : expected)) {
      throw new Error(`Shell ${key} target mismatch; E2E aborted before inspection.`);
    }
  }
  for (const app of ["admin", "teacher", "portal"]) {
    const local = appTarget(path.join(root, "apps", app), "NEXT_PUBLIC_CONVEX_URL");
    if (local !== undefined && local !== expected) {
      throw new Error(`${app} NEXT_PUBLIC_CONVEX_URL target mismatch; E2E aborted before inspection.`);
    }
    if ((env.NEXT_PUBLIC_CONVEX_URL ?? local) !== expected) {
      throw new Error(`${app} NEXT_PUBLIC_CONVEX_URL must match the expected cloud URL; E2E aborted before inspection.`);
    }
    const site = appTarget(path.join(root, "apps", app), "NEXT_PUBLIC_CONVEX_SITE_URL");
    if (site !== undefined && site !== expectedSite) {
      throw new Error(`${app} NEXT_PUBLIC_CONVEX_SITE_URL target mismatch; E2E aborted before inspection.`);
    }
    if ((env.NEXT_PUBLIC_CONVEX_SITE_URL ?? site ?? expectedSite) !== expectedSite) {
      throw new Error(`${app} effective NEXT_PUBLIC_CONVEX_SITE_URL target mismatch; E2E aborted before inspection.`);
    }
  }
  return expected;
}

function cliInvocation(functionName, args, nodeExecutable = process.execPath) {
  const convexCli = path.join(path.dirname(require.resolve("convex/package.json")), "bin", "main.js");
  return { command: nodeExecutable, args: [convexCli, "run", functionName, JSON.stringify(args)] };
}

function runFirstSeed(env, runner = execFileSync, appTarget = configuredValue) {
  const expected = requireTarget(env, appTarget);
  const identity = { operatorToken: env.DEMO_SEED_OPERATOR_TOKEN, targetIdentity: env.DEMO_SEED_DEPLOYMENT_IDENTITY };
  const call = (functionName, args) => {
    const invocation = cliInvocation(functionName, args);
    try {
      return runner(invocation.command, invocation.args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env });
    } catch {
      // CLI output may contain credentials or target details. Do not relay it.
      if (functionName === "functions/academic/seedRunner:seedDemoSchool") {
        throw new Error("E2E first seed failed; abandon and replace the disposable dev deployment. Do not retry or reset it.");
      }
      throw new Error(`E2E ${functionName} CLI call failed; check the target and operator gate privately.`);
    }
  };
  let inspection;
  try {
    inspection = JSON.parse(call("functions/academic/demoPreflightAction:inspectDemoSchool", identity));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("E2E preflight returned invalid JSON; seed was not invoked.");
    throw error;
  }
  if (inspection?.cloudUrl !== expected) throw new Error("E2E preflight server cloud URL does not match expected target; seed was not invoked.");
  if (inspection.e2eOriginsTrusted !== true) throw new Error("E2E preflight server does not trust all localhost:3101-3103 origins; seed was not invoked.");
  if (inspection.school !== null || inspection.ready !== true || !Array.isArray(inspection.blockers) || inspection.blockers.length ||
      !Array.isArray(inspection.tables) || inspection.tables.length) {
    throw new Error("E2E target is not empty or preflight has blockers; seed was not invoked. Replace the disposable dev deployment after a partial run; do not retry or reset it.");
  }
  call("functions/academic/seedRunner:seedDemoSchool", {
    ...identity, confirmation: "RESET demo-school", deploymentEnvironment: "development",
    inspectedSchoolId: null, inspectedSchoolSlug: DEMO_SLUG,
  });
}

module.exports = function globalSetup() { runFirstSeed(process.env); };
module.exports.runFirstSeed = runFirstSeed;
module.exports.requireTarget = requireTarget;
module.exports.cliInvocation = cliInvocation;
