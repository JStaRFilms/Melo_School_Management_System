import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const build = join(root, "apps/sites/.next");
const assetPaths = [
  "obhis-homepage-prototype-assets/school-logo.png",
  "obhis-generated-study/hero-cutout.webp",
  "obhis-generated-study/you-hero.webp",
  "obhis-homepage-prototype-assets/classroom-moment.webp",
  ...["school-friends", "classroom-table", "cultural-day-abuja", "cultural-day-rugam", "uniform-detail"].map(key => `obhis-homepage-review-assets/${key}.webp`),
].map(path => `docs/mockups/sites/${path}`);
const images = await Promise.all(assetPaths.map(async path => ({ path, bytes: await readFile(join(root, path)) })));

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    // Dev output and caches are not deployment artifacts.
    if (entry.name === "dev" || entry.name === "cache") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else files.push(path);
  }
  return files;
}

let traceCount = 0;
let outputCount = 0;
for (const path of await filesUnder(build)) {
  const bytes = await readFile(path);
  outputCount += 1;
  for (const image of images) assert(!bytes.includes(image.bytes), `Private image bytes in ${path}: ${image.path}`);
  if (path.endsWith(".nft.json")) {
    traceCount += 1;
    const trace = JSON.parse(bytes.toString("utf8"));
    for (const file of trace.files) {
      const traced = resolve(dirname(path), file).replaceAll("\\", "/");
      assert(!/\/docs\/mockups\/sites\/(obhis-homepage-review-assets|obhis-homepage-prototype-assets|obhis-generated-study)\//.test(traced), `Private review file traced: ${traced}`);
    }
  }
}
assert(traceCount > 0, "No build traces found");

const protectedPaths = [
  "docs/mockups/sites/obhis-homepage-review.html", "docs/mockups/sites/obhis-homepage-review.css", "docs/mockups/sites/obhis-homepage-review.js",
  "docs/mockups/sites/obhis-motion-prototype.html", "docs/mockups/sites/obhis-motion-prototype.css", "docs/mockups/sites/obhis-motion-prototype.js",
  "docs/mockups/sites/obhis-homepage-prototype-assets", "docs/mockups/sites/obhis-homepage-review-assets", "docs/mockups/sites/obhis-generated-study",
  "apps/sites/lib/site.ts", "apps/sites/lib/site-ui.tsx", "apps/sites/proxy.ts", "apps/sites/app/[[...slug]]/page.tsx",
  "apps/sites/app/layout.tsx", "apps/sites/app/globals.css", "apps/sites/app/robots.ts", "apps/sites/app/sitemap.ts", "apps/sites/app/manifest.ts",
  "package.json", "pnpm-lock.yaml", "apps/sites/package.json",
];
const tracked = execFileSync("git", ["ls-files", "-z", "--", ...protectedPaths], { cwd: root }).toString("utf8").split("\0").filter(Boolean);
for (const path of tracked) {
  const committed = execFileSync("git", ["show", `HEAD:${path}`], { cwd: root, maxBuffer: 50 * 1024 * 1024 });
  const current = await readFile(join(root, path));
  // This Windows checkout uses core.autocrlf for some existing text files.
  // Approved homepage/motion sources and review media require exact blob bytes.
  const requiresExactBytes = assetPaths.includes(path) || /obhis-(homepage-review|motion-prototype)\.(html|css|js)$/.test(path);
  const unchangedCheckout = !requiresExactBytes && Buffer.from(committed.toString("utf8").replaceAll("\n", "\r\n")).equals(current);
  assert(committed.equals(current) || unchangedCheckout, `Protected source changed: ${path}`);
}
console.log(`PASS: ${outputCount} production files, ${traceCount} traces, ${images.length} private images excluded; ${tracked.length} protected files unchanged, with exact approved prototype/media bytes and checkout CRLF accounted for in other text files.`);
