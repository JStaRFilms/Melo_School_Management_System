#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "stills";
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? chromium.executablePath();

mkdirSync(path.resolve("artifacts"), { recursive: true });

const stillFrames = [
  [75, "melo-report-cards-demo-01-hook.png"],
  [104, "melo-report-cards-demo-02-class-click-down.png"],
  [120, "melo-report-cards-demo-03-class-commit.png"],
  [168, "melo-report-cards-demo-04-exam-click-down.png"],
  [222, "melo-report-cards-demo-05-score-ready.png"],
  [405, "melo-report-cards-demo-06-preview-click-down.png"],
  [450, "melo-report-cards-demo-07-report-commit.png"],
  [510, "melo-report-cards-demo-08-report-highlight.png"],
  [690, "melo-report-cards-demo-09-cta.png"],
];

const debugFrames = [
  [222, "melo-report-cards-demo-debug-score-targets.png"],
  [510, "melo-report-cards-demo-debug-report-targets.png"],
];

function runRemotion(args) {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@school/www", "exec", "remotion", ...args, `--browser-executable=${browserExecutable}`],
    { cwd: process.cwd(), shell: process.platform === "win32", stdio: "inherit" },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function renderStillSet(compositionId, frames) {
  for (const [frame, fileName] of frames) {
    runRemotion([
      "still",
      "remotion/Root.tsx",
      compositionId,
      path.join("..", "..", "artifacts", fileName),
      `--frame=${frame}`,
    ]);
  }
}

function renderVideo() {
  runRemotion([
    "render",
    "remotion/Root.tsx",
    "MeloReportCardsDemo",
    path.join("..", "..", "artifacts", "melo-report-cards-demo.mp4"),
  ]);
}

switch (mode) {
  case "stills":
    renderStillSet("MeloReportCardsDemo", stillFrames);
    console.log("Rendered Melo report-card demo stills into artifacts/.");
    break;
  case "debug":
    renderStillSet("MeloReportCardsDemoDebug", debugFrames);
    console.log("Rendered Melo report-card demo debug target stills into artifacts/.");
    break;
  case "video":
    renderVideo();
    console.log("Rendered artifacts/melo-report-cards-demo.mp4.");
    break;
  case "all":
    renderStillSet("MeloReportCardsDemo", stillFrames);
    renderStillSet("MeloReportCardsDemoDebug", debugFrames);
    renderVideo();
    console.log("Rendered Melo report-card demo stills, debug stills, and final video into artifacts/.");
    break;
  default:
    console.error(`Unknown mode: ${mode}. Use stills, debug, video, or all.`);
    process.exit(1);
}
