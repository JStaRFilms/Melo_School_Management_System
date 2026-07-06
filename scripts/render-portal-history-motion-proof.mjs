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
  [54, "portal-history-motion-see-results.png"],
  [118, "portal-history-motion-select-term.png"],
  [172, "portal-history-motion-open-report.png"],
  [232, "portal-history-motion-export-print.png"],
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
      "PortalHistoryMotionProof",
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

console.log("Rendered portal history motion proof stills into artifacts/.");
