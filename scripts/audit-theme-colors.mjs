import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

let base = process.env.THEME_AUDIT_BASE;
if (!base) {
  try {
    base = git(["merge-base", "HEAD", "origin/main"]);
  } catch {
    base = "HEAD~1";
  }
}

const requestedFiles = process.argv.slice(2);
const changedFiles = (requestedFiles.length
  ? requestedFiles
  : git(["diff", "--name-only", base, "--", "apps", "packages", "AGENTS.md"]).split(/\r?\n/)
)
  .filter(Boolean)
  .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));

const directColor = /#[\da-f]{3,8}\b|\b(?:red|green|blue|amber|rose|emerald|indigo|violet)-\d{2,3}\b/gi;
const themed = /--school-|deriveSchoolTheme|brand-(?:primary|accent|focus|progress)/;

console.log(`Theme colour audit (informational; comparison base: ${base})`);
for (const file of changedFiles) {
  const source = readFileSync(file, "utf8");
  const colours = [...new Set(source.match(directColor) ?? [])];
  if (!colours.length) continue;
  const classification = themed.test(source)
    ? "tenant token seam; review remaining literals as status/grade/neutral/print"
    : "direct colours; classify before changing (no global replacement)";
  console.log(`- ${file}: ${classification} (${colours.join(", ")})`);
}
