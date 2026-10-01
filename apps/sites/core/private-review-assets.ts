import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { privateReviewEnabled, type ReviewAssetKey } from "./private-review";

const files: Readonly<Record<ReviewAssetKey, readonly [string, string, string]>> = {
  "school-logo": ["obhis-homepage-prototype-assets", "school-logo.png", "image/png"],
  "hero-cutout": ["obhis-generated-study", "hero-composed.webp", "image/webp"],
  "you-hero": ["obhis-generated-study", "you-hero.webp", "image/webp"],
  "classroom-moment": ["obhis-homepage-prototype-assets", "classroom-moment.webp", "image/webp"],
  "school-friends": ["obhis-homepage-review-assets", "school-friends.webp", "image/webp"],
  "classroom-table": ["obhis-homepage-review-assets", "classroom-table.webp", "image/webp"],
  "cultural-day-abuja": ["obhis-homepage-review-assets", "cultural-day-abuja.webp", "image/webp"],
  "cultural-day-rugam": ["obhis-homepage-review-assets", "cultural-day-rugam.webp", "image/webp"],
  "uniform-detail": ["obhis-homepage-review-assets", "uniform-detail.webp", "image/webp"],
};

export async function readPrivateReviewAsset(key: string) {
  // Recheck here as well as at the route. Never read a private file in production.
  if (!privateReviewEnabled() || !Object.hasOwn(files, key)) return null;
  const asset = files[key as ReviewAssetKey];
  const [directory, filename, contentType] = asset;
  // The route's development branch is removed from production bundles. No
  // static image imports or file URLs enter Next's production tracing graph.
  const bytes = await readFile(join(process.cwd(), "..", "..", "docs", "mockups", "sites", directory, filename));
  return { bytes, contentType };
}
