const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  globalSetup: require.resolve("./e2e/global-setup.js"),
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @school/admin dev",
      url: "http://localhost:3002/sign-in",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter @school/teacher dev",
      url: "http://localhost:3001/sign-in",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
