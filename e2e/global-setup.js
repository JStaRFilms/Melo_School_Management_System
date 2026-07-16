const { execFileSync } = require("node:child_process");
const path = require("node:path");

const PRODUCTION_CONFIRMATION = "RESET demo-school IN PRODUCTION";

function buildSeedInvocation(env, nodeExecutable = process.execPath) {
  const operatorToken = env.DEMO_SEED_OPERATOR_TOKEN;
  const targetIdentity = env.DEMO_SEED_DEPLOYMENT_IDENTITY;
  const deploymentEnvironment = env.DEMO_SEED_DEPLOYMENT_ENV;
  if (!operatorToken || !targetIdentity || !deploymentEnvironment) {
    throw new Error("DEMO_SEED_OPERATOR_TOKEN, DEMO_SEED_DEPLOYMENT_IDENTITY, and DEMO_SEED_DEPLOYMENT_ENV are required for the destructive demo-school reset.");
  }
  const args = { confirmation: "RESET demo-school", operatorToken, targetIdentity, deploymentEnvironment };
  if (deploymentEnvironment === "production") {
    // This must be independently supplied by the invoking operator/CI secret;
    // setup never manufactures a production confirmation.
    if (env.DEMO_SEED_PRODUCTION_CONFIRMATION !== PRODUCTION_CONFIRMATION) {
      throw new Error("Production E2E reset requires DEMO_SEED_PRODUCTION_CONFIRMATION set exactly to the dedicated confirmation phrase.");
    }
    args.productionConfirmation = env.DEMO_SEED_PRODUCTION_CONFIRMATION;
  }
  const convexCli = path.join(
    path.dirname(require.resolve("convex/package.json")),
    "bin",
    "main.js"
  );
  return {
    command: nodeExecutable,
    args: [
      convexCli,
      "run",
      "functions/academic/seedRunner:seedDemoSchool",
      JSON.stringify(args),
    ],
  };
}

async function globalSetup() {
  const invocation = buildSeedInvocation(process.env);
  // execFileSync passes JSON as one argument on Windows, POSIX shells, and CI.
  execFileSync(invocation.command, invocation.args, { stdio: "inherit" });
}

module.exports = globalSetup;
module.exports.buildSeedInvocation = buildSeedInvocation;
module.exports.PRODUCTION_CONFIRMATION = PRODUCTION_CONFIRMATION;
