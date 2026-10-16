import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);
const ts = require("typescript");
const nextPackage = require.resolve("next/package.json", { paths: [path.join(root, "apps/sites")] });
const sharp = createRequire(nextPackage)("sharp");
const output = path.join(root, "deliverables/obhis-hosted-launch");
const sources = [
  ["school_logo", "obhis-homepage-prototype-assets/school-logo.png", "logo"],
  ["hero_cutout", "obhis-generated-study/hero-composed.webp", "hero"],
  ["you_hero", "obhis-generated-study/you-hero.webp", "hero"],
  ["classroom_moment", "obhis-homepage-prototype-assets/classroom-moment.webp", "gallery"],
  ["school_friends", "obhis-homepage-review-assets/school-friends.webp", "gallery"],
  ["classroom_table", "obhis-homepage-review-assets/classroom-table.webp", "gallery"],
  ["cultural_day_abuja", "obhis-homepage-review-assets/cultural-day-abuja.webp", "gallery"],
  ["cultural_day_rugam", "obhis-homepage-review-assets/cultural-day-rugam.webp", "gallery"],
  ["uniform_detail", "obhis-homepage-review-assets/uniform-detail.webp", "gallery"],
];
const reviewSource = await fs.readFile(path.join(root, "apps/sites/core/obhis-review-model.ts"), "utf8");
const compiled = ts.transpileModule(reviewSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const model = exports.oliveFromPrivateReview({
  displayName: "Olive Blessed Crest Academy",
  assets: Object.fromEntries(sources.map(([field]) => [field.replaceAll("_", "-"), field])),
  theme: {},
});
const fixtureSource = await fs.readFile(path.join(root, "apps/sites/core/obhis-review-fixture.ts"), "utf8");
const primaryColor = fixtureSource.match(/primaryColor: "(#[0-9a-f]{6})"/)?.[1];
const accentColor = fixtureSource.match(/accentColor: "(#[0-9a-f]{6})"/)?.[1];
if (!primaryColor || !accentColor) throw new Error("Review theme inputs were not found");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
await fs.mkdir(path.join(output, "assets"), { recursive: true });
const assets = [];
const tiles = [];
for (const [fieldId, relative, kind] of sources) {
  const sourcePath = path.join(root, "docs/mockups/sites", relative);
  const original = await fs.readFile(sourcePath);
  const bytes = await sharp(original).png({ compressionLevel: 9 }).toBuffer();
  const metadata = await sharp(bytes).metadata();
  if (bytes.length > 5_000_000) throw new Error(`${fieldId} exceeds the upload limit`);
  if ([metadata.exif, metadata.xmp, metadata.iptc, metadata.icc].some(Boolean)) throw new Error(`${fieldId} retains metadata`);
  const before = await sharp(original).ensureAlpha().raw().toBuffer();
  const after = await sharp(bytes).ensureAlpha().raw().toBuffer();
  if (!before.equals(after)) throw new Error(`${fieldId} pixels changed`);
  if (hash(await fs.readFile(sourcePath)) !== hash(original)) throw new Error(`${fieldId} source changed`);
  const file = `assets/${fieldId}.png`;
  await fs.writeFile(path.join(output, file), bytes, { flag: "wx" });
  assets.push({ fieldId, kind, file, altText: model.assets[fieldId].alt, decorative: false,
    source: `docs/mockups/sites/${relative}`, sourceSha256: hash(original), preparedSha256: hash(bytes),
    byteSize: bytes.length, width: metadata.width, height: metadata.height,
    rightsStatus: "pending", childApplicability: "unknown", childConsentStatus: "unverified",
    uploaded: false, pixelsPreserved: true, metadataRemoved: true });
  const label = Buffer.from(`<svg width="360" height="32"><rect width="100%" height="100%" fill="white"/><text x="8" y="22" font-size="17" font-family="sans-serif">${fieldId}</text></svg>`);
  const tile = await sharp(bytes).resize(360, 248, { fit: "contain", background: "#eeeeee" })
    .extend({ bottom: 32, background: "white" }).composite([{ input: label, left: 0, top: 248 }]).png().toBuffer();
  tiles.push({ input: tile, left: (tiles.length % 3) * 360, top: Math.floor(tiles.length / 3) * 280 });
}
const text = { ...model.text, primary_color: primaryColor, accent_color: accentColor };
for (const asset of assets) text[`${asset.fieldId}_alt`] = asset.altText;
const candidate = {
  kind: "private-hosted-launch-candidate",
  target: { deployment: "prod:outgoing-warbler-782", schoolId: "kd73q7dt28ph1bmqjm20tsw2ed83k6j3", schoolSlug: "obhis-fedrah", rendererKey: "obhis-v1", rendererSchemaVersion: "1" },
  textFields: Object.entries(text).map(([fieldId, value]) => ({ fieldId, value: { kind: "text", value } })),
  assetUploads: assets,
  routeSeo: [],
  approvalsRecorded: false,
  note: "Local preparation only. Upload assets through the authenticated school workflow, then build real asset references. Independent evidence review and publishing permissions remain required.",
};
await fs.writeFile(path.join(output, "content-candidate.json"), JSON.stringify(candidate, null, 2) + "\n", { flag: "wx" });
const sheet = await sharp({ create: { width: 1080, height: 840, channels: 3, background: "white" } }).composite(tiles).jpeg({ quality: 85 }).toBuffer();
await fs.writeFile(path.join(output, "contact-sheet.jpg"), sheet, { flag: "wx" });
console.log(JSON.stringify({ output: "deliverables/obhis-hosted-launch", textFields: candidate.textFields.length, assets: assets.length, totalBytes: assets.reduce((sum, asset) => sum + asset.byteSize, 0), allPixelsPreserved: true, allSourcesPreserved: true, uploaded: false, published: false }));
