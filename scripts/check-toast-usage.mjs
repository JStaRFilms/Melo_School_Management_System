import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["apps"];
const ignoredDirs = new Set([".next", "node_modules", "dist", "build", "coverage"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const bannedPatterns = [
  /\bsetNotice\b/,
  /\bconst \[notice,\s*setNotice\]/,
  /\bFloatingNotice\b/,
  /\bSystem Message\b/,
  /\bsetStatusMessage\b/,
  /\bstatusMessage\b/,
  /\bsetSuccessMessage\b/,
];

const allowedPatterns = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    const ext = fullPath.slice(fullPath.lastIndexOf("."));
    if (extensions.has(ext)) files.push(fullPath);
  }
  return files;
}

const violations = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!bannedPatterns.some((pattern) => pattern.test(line))) return;
      if (allowedPatterns.some((pattern) => pattern.test(line))) return;

      violations.push(`${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`);
    });
  }
}

if (violations.length > 0) {
  console.error("Legacy inline notification patterns found. Use @school/shared/toast appToast instead.\n");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Toast usage check passed.");
