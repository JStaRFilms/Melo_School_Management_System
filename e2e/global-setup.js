const { execSync } = require("node:child_process");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function globalSetup() {
  const command = "pnpm exec convex run functions/academic/seedRunner:seedExamRecordingData";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      execSync(command, { stdio: "inherit" });
      return;
    } catch (error) {
      if (attempt === 3) {
        console.warn(
          "[playwright global setup] Demo-data seed failed after 3 attempts. Continuing with existing data."
        );
        return;
      }

      console.warn(
        `[playwright global setup] Demo-data seed attempt ${attempt} failed. Retrying...`
      );
      await sleep(2_000);
    }
  }
};
