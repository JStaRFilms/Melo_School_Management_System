#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

mkdirSync(path.resolve("artifacts"), { recursive: true });

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? chromium.executablePath();
const output = process.env.PORTAL_HISTORY_MOTION_OUTPUT ?? "../../artifacts/portal-history-motion-proof.mp4";

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@school/www",
    "exec",
    "remotion",
    "render",
    "remotion/Root.tsx",
    "PortalHistoryMotionProof",
    output,
    `--browser-executable=${browserExecutable}`,
  ],
  { cwd: process.cwd(), shell: process.platform === "win32", stdio: "inherit" }
);

process.exit(result.status ?? 1);
