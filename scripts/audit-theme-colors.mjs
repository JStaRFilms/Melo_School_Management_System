import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const changedFiles = execFileSync("git", ["diff", "--name-only", "--", "apps", "packages", "AGENTS.md"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));

const directColor = /#[\da-f]{3,8}\b|\b(?:red|green|blue|amber|rose|emerald|indigo|violet)-\d{2,3}\b/gi;
const themed = /--school-|deriveSchoolTheme|brand-(?:primary|accent|focus|progress)/;

console.log("Theme colour audit (informational; no files are changed)");
for (const file of changedFiles) {
  const source = readFileSync(file, "utf8");
  const colours = [...new Set(source.match(directColor) ?? [])];
  if (!colours.length) continue;
  const classification = themed.test(source)
    ? "tenant token seam; review remaining literals as status/grade/neutral/print"
    : "direct colours; classify before changing (no global replacement)";
  console.log(`- ${file}: ${classification} (${colours.join(", ")})`);
}
