#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

mkdirSync(path.resolve("artifacts"), { recursive: true });

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? chromium.executablePath();
const output = process.env.PORTAL_COMPONENT_PROOF_OUTPUT ?? "../../artifacts/portal-component-proof.mp4";

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@school/www",
    "exec",
    "remotion",
    "render",
    "remotion/Root.tsx",
    "PortalComponentProof",
    output,
    `--browser-executable=${browserExecutable}`,
  ],
  { cwd: process.cwd(), shell: process.platform === "win32", stdio: "inherit" }
);

process.exit(result.status ?? 1);
