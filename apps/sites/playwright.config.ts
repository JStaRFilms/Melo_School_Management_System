import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://obhis.localhost:3005", headless: true },
  webServer: [
    { command: "node e2e/projection-server.mjs", port: 4010, reuseExistingServer: !process.env.CI },
    { command: "pnpm start", port: 3005, reuseExistingServer: !process.env.CI, env: { ...process.env, SITE_PUBLIC_CONTENT_ENDPOINT: "http://127.0.0.1:4010/public", SITE_PREVIEW_CONTENT_ENDPOINT: "http://127.0.0.1:4010/preview" } },
  ],
});
