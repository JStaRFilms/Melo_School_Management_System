const { defineConfig } = require("@playwright/test");

const schoolSlug = process.env.E2E_ADMISSIONS_SCHOOL_SLUG ?? "playwright-health";

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "admissions-smoke.spec.js",
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "pnpm --filter @school/admin dev",
      url: "http://localhost:3002/sign-in",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: "pnpm --filter @school/apply dev",
      url: `http://localhost:3004/s/${encodeURIComponent(schoolSlug)}`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
