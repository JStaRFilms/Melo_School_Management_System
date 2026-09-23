const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

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

async function privateAction(expectedUrl, functionName, args) {
  const client = new ConvexHttpClient(expectedUrl);
  return client.action(makeFunctionReference(functionName), args);
}

async function terminalQuestion(text) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => rl.close());
  try { return await rl.question(text); }
  catch { return null; }
  finally { rl.close(); }
}

function requireInteractive(env, input) {
  if (env.CI || !input.stdinTTY || !input.stdoutTTY) {
    throw new Error("E2E populated reset requires stdin and stdout TTY and is forbidden in CI; no reset started.");
  }
}

async function runFirstSeed(env, runner = privateAction, appTarget = configuredValue,
  input = { stdinTTY: process.stdin.isTTY, stdoutTTY: process.stdout.isTTY, ask: terminalQuestion, log: console.log }, resume = null) {
  const expected = requireTarget(env, appTarget);
  const identity = { operatorToken: env.DEMO_SEED_OPERATOR_TOKEN, targetIdentity: env.DEMO_SEED_DEPLOYMENT_IDENTITY };
  const call = async (functionName, args) => {
    try {
      return await runner(expected, functionName, args);
    } catch {
      // Network and server errors can contain private details. Do not relay them.
      if (functionName === "functions/academic/seedRunner:seedDemoSchool") {
        throw new Error("E2E first seed failed; abandon and replace the disposable dev deployment. Do not retry or reset it.");
      }
      throw new Error(`E2E ${functionName} HTTPS action failed; check the target and operator gate privately.`);
    }
  };
  if (env.E2E_DEMO_VERIFY_OPERATION_ID !== undefined) {
    const operationId = env.E2E_DEMO_VERIFY_OPERATION_ID;
    if (!operationId || !/^[a-z0-9]+$/.test(operationId)) throw new Error("E2E verify requires a completed operation ID.");
    const result = await call("functions/academic/demoResetAction:verifyCompletedDemoReset", { ...identity, operationId });
    if (result?.cloudUrl !== expected || result.operationId !== operationId || result.status !== "complete" ||
        !result.schoolId || !result.runId || result.studentCount !== 36 || result.classCount !== 3 ||
        result.invoiceCount !== 36 || result.assessmentRecordCount !== 756) {
      throw new Error("E2E completed reset verification failed; no reset or seed invoked.");
    }
    input.log(`Verified completed operation ${operationId} on ${expected}; school ${result.schoolId}, run ${result.runId}.`);
    return;
  }
  const reset = (seal) => ({ ...identity, deploymentEnvironment: "development", schoolSlug: DEMO_SLUG, ...seal });
  let approved;
  let stage;
  if (resume) {
    requireInteractive(env, input);
    const { operationId, schoolId, inventoryHash, confirmationPhrase } = resume;
    if (![operationId, schoolId, inventoryHash, confirmationPhrase].every((value) => typeof value === "string" && value.length) ||
        !/^[a-f0-9]{64}$/.test(inventoryHash) ||
        !confirmationPhrase.startsWith(`RESET demo-school ${schoolId} ${inventoryHash} `) ||
        !/^RESET demo-school .+ [a-f0-9]{64} [a-f0-9]{32}$/.test(confirmationPhrase)) {
      throw new Error("Resume requires the exact operator-supplied operation ID, original school ID, hash and phrase.");
    }
    approved = reset(resume);
    stage = (await call("functions/academic/demoResetAction:inspectDemoResetOperation", approved)).status;
    input.log(`Resume operation ${operationId}, original school ${schoolId}, deployment ${expected}, status ${stage}, hash ${inventoryHash}.`);
    input.log(`Type the full phrase to resume: ${confirmationPhrase}`);
    if (await input.ask("Confirmation: ") !== confirmationPhrase) throw new Error("Resume confirmation cancelled or incorrect; no reset action invoked.");
  } else {
    const inspection = await call("functions/academic/demoPreflightAction:inspectDemoSchool", identity);
    if (inspection?.cloudUrl !== expected) throw new Error("E2E preflight server cloud URL does not match expected target; seed was not invoked.");
    if (inspection.e2eOriginsTrusted !== true) throw new Error("E2E preflight server does not trust all localhost:3101-3103 origins; seed was not invoked.");
    if (inspection.school === null && inspection.ready === true && Array.isArray(inspection.blockers) && !inspection.blockers.length &&
        Array.isArray(inspection.tables) && !inspection.tables.length) {
      await call("functions/academic/seedRunner:seedDemoSchool", {
        ...identity, confirmation: "RESET demo-school", deploymentEnvironment: "development",
        inspectedSchoolId: null, inspectedSchoolSlug: DEMO_SLUG,
      });
      return;
    }
    if (!inspection.school || inspection.ready !== true || !Array.isArray(inspection.blockers) || inspection.blockers.length ||
        !Array.isArray(inspection.tables) || inspection.tables.some((row) => row.truncated)) {
      throw new Error("E2E preflight has blockers or an unknown cohort; no reset or seed invoked.");
    }
    requireInteractive(env, input); // Before reserving any operation.
    const prepared = await call("functions/academic/demoResetAction:prepareDemoReset", identity);
    if (prepared.schoolId !== inspection.school.id || !prepared.operationId || !/^[a-f0-9]{64}$/.test(prepared.inventoryHash) ||
        !prepared.confirmationPhrase?.startsWith(`RESET demo-school ${prepared.schoolId} ${prepared.inventoryHash} `) ||
        !Array.isArray(prepared.counts)) {
      throw new Error("Prepared reset did not match preflight. Inspect the reservation privately; do not start another operation.");
    }
    approved = reset({ operationId: prepared.operationId, schoolId: prepared.schoolId,
      inventoryHash: prepared.inventoryHash, confirmationPhrase: prepared.confirmationPhrase });
    stage = "prepared";
    input.log(`Prepared operation ${prepared.operationId}, school ${prepared.schoolId}, deployment ${expected}.`);
    for (const row of prepared.counts) if (row.count > 0) input.log(`${row.table}: ${row.count}`);
    input.log(`Operation hash: ${prepared.inventoryHash}`);
    input.log(`Type the full phrase to delete and reseed: ${prepared.confirmationPhrase}`);
    let answer;
    try { answer = await input.ask("Confirmation: "); }
    catch { answer = null; }
    if (answer !== prepared.confirmationPhrase) {
      await call("functions/academic/demoResetAction:cancelDemoReset", { ...identity, operationId: prepared.operationId });
      throw new Error("Reset cancelled or confirmation incorrect; reservation cancelled without deleting rows.");
    }
  }
  try {
    if (["prepared", "deleting", "storage_pending", "auth_pending"].includes(stage)) {
      const result = await call("functions/academic/demoResetAction:executeDemoReset", approved);
      if (result.status !== "ready_to_seed" || result.operationId !== approved.operationId) throw new Error("Reset did not return ready_to_seed.");
      stage = result.status;
    }
    if (!["ready_to_seed", "seeding", "complete"].includes(stage)) throw new Error("Unknown reset status.");
    const finished = await call("functions/academic/demoResetSeedAction:finishDemoReset", approved);
    if (finished.status !== "complete" || finished.operationId !== approved.operationId) throw new Error("Bound reset seed did not complete.");
  } catch {
    throw new Error(`Reset interrupted. Resume the SAME operation ${approved.operationId} for school ${approved.schoolId} on ${expected} using its original hash and phrase. Run node e2e/global-setup.js resume in a TTY; do not prepare a new reset or first-run seed.`);
  }
}

module.exports = function globalSetup() { return runFirstSeed(process.env); };
module.exports.runFirstSeed = runFirstSeed;
module.exports.requireTarget = requireTarget;
module.exports.privateAction = privateAction;

if (require.main === module) {
  (async () => {
    if (process.env.E2E_DEMO_VERIFY_OPERATION_ID !== undefined) {
      if (process.argv.length !== 2) throw new Error("Verify-only mode does not accept resume arguments.");
      await runFirstSeed(process.env);
      return;
    }
    if (process.argv.length !== 3 || process.argv[2] !== "resume") throw new Error("Usage: node e2e/global-setup.js resume (interactive TTY only), or set E2E_DEMO_VERIFY_OPERATION_ID for read-only verification");
    const input = { stdinTTY: process.stdin.isTTY, stdoutTTY: process.stdout.isTTY, ask: terminalQuestion, log: console.log };
    requireInteractive(process.env, input);
    const operationId = await input.ask("Existing operation ID: ");
    const schoolId = await input.ask("Original school ID: ");
    const inventoryHash = await input.ask("Original inventory hash: ");
    const confirmationPhrase = await input.ask("Original full confirmation phrase: ");
    await runFirstSeed(process.env, privateAction, configuredValue, input,
      { operationId, schoolId, inventoryHash, confirmationPhrase });
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
