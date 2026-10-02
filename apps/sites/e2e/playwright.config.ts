import { defineConfig } from "@playwright/test";

const production = process.env.OBHIS_TEST_MODE === "production";
const denied = process.env.OBHIS_TEST_MODE === "denied";
const enabledPort = production ? 3217 : denied ? 3216 : 3215;
const server = (port: number, optIn: string, mode: "dev" | "start") => ({
  command: `pnpm exec cross-env OBHIS_LOCAL_REVIEW=${optIn} SITES_ENABLE_LEGACY_DEMOS=enabled pnpm --filter @school/sites exec next ${mode} ${mode === "dev" ? "--webpack " : ""}--hostname 127.0.0.1 --port ${port}`,
  cwd: "../../..",
  url: `http://127.0.0.1:${port}/icon.png`,
  reuseExistingServer: false,
  timeout: 180_000,
});

export default defineConfig({
  testDir: ".",
  testMatch: production || denied ? "private-routes.spec.ts" : "*.spec.ts",
  outputDir: "../../../deliverables/obhis-local-review/test-results",
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${enabledPort}`,
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: process.env.OBHIS_CHROMIUM_EXECUTABLE ? { executablePath: process.env.OBHIS_CHROMIUM_EXECUTABLE } : undefined,
  },
  webServer: [server(enabledPort, denied ? "0" : "1", production ? "start" : "dev")],
});
