#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const outputDir = path.resolve("artifacts");
mkdirSync(outputDir, { recursive: true });

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? chromium.executablePath();
const frames = [
  [30, "portal-component-proof.png"],
  [130, "portal-component-proof-report.png"],
  [220, "portal-component-proof-billing.png"],
];

for (const [frame, fileName] of frames) {
  const output = path.join("..", "..", "artifacts", fileName);
  const result = spawnSync(
    "pnpm",
    [
      "--filter",
      "@school/www",
      "exec",
      "remotion",
      "still",
      "remotion/Root.tsx",
      "PortalComponentProof",
      output,
      `--frame=${frame}`,
      `--browser-executable=${browserExecutable}`,
    ],
    { cwd: process.cwd(), shell: process.platform === "win32", stdio: "inherit" }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Rendered code-native portal component proof stills into artifacts/.");
