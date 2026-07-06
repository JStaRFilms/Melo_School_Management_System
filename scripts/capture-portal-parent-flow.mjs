#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baseUrl = process.env.PORTAL_URL ?? "http://localhost:3003";
const outputDir = path.resolve(process.env.PORTAL_FLOW_OUTPUT ?? "artifacts/portal-parent-flow");
const headless = process.env.HEADFUL !== "1";
const keepServer = process.env.KEEP_PORTAL_SERVER === "1";

async function isServerReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

function startPortalServer() {
  const child = spawn("pnpm", ["--filter", "@school/portal", "dev"], {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NEXT_PUBLIC_PORTAL_DEMO_MODE: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[portal] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[portal] ${chunk}`));

  return child;
}

async function waitForServer(timeoutMs = 180_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Portal server did not become ready at ${baseUrl}`);
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(450);
}

async function capture(page, name) {
  await settle(page);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
}

async function clickVisible(page, role, options) {
  const locator = page.getByRole(role, options).first();
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await settle(page);
}

function stopPortalServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");
}

let server = null;
let browser = null;

try {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  if (!(await isServerReady())) {
    server = startPortalServer();
    await waitForServer();
  }

  browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Sarah Sunday" }).waitFor({ timeout: 30_000 });
  await capture(page, "01-dashboard");

  await clickVisible(page, "link", { name: /Full report/i });
  await page.locator("h1", { hasText: "Report Cards" }).waitFor({ timeout: 15_000 });
  await capture(page, "02-report-card");

  await clickVisible(page, "button", { name: /David Sunday/i });
  await page.getByText("David Sunday").first().waitFor({ timeout: 15_000 });
  await capture(page, "03-report-card-second-child");

  await clickVisible(page, "link", { name: /^Billing$/i });
  await page.getByRole("heading", { name: "Fees & payments" }).waitFor({ timeout: 15_000 });
  await capture(page, "04-billing");

  const payButton = page.getByRole("button", { name: /Pay .* now/i }).first();
  if (await payButton.isVisible().catch(() => false)) {
    await payButton.click();
    await page.getByText("Demo mode: payment checkout is mocked for video capture.").waitFor({ timeout: 15_000 });
    await capture(page, "05-mocked-payment");
  }

  await clickVisible(page, "link", { name: /^Notifications$/i });
  await page.getByRole("heading", { name: "School updates" }).waitFor({ timeout: 15_000 });
  await capture(page, "06-notifications");

  await context.close();
  console.log(`Portal parent flow captured in ${outputDir}`);
} finally {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  if (server && !keepServer) {
    stopPortalServer(server);
  }
}
