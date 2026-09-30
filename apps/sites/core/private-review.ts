import { deriveSchoolTheme, normalizeThemeColor, type SchoolThemeDerivation, type SchoolThemeInputs } from "@school/shared/theme";
import type { ApplicationLinkV1 } from "../../../packages/shared/src/admissions-foundation";

export const REVIEW_ASSET_KEYS = [
  "school-logo", "hero-cutout", "you-hero", "classroom-moment",
  "school-friends", "classroom-table", "cultural-day-abuja", "cultural-day-rugam", "uniform-detail",
] as const;
export type ReviewAssetKey = typeof REVIEW_ASSET_KEYS[number];

/** Local review only. These are not approved public assets or a published revision. */
export interface PrivateReviewContext {
  readonly kind: "private-local-review";
  readonly rendererKey: "obhis-v1";
  readonly schemaVersion: 1;
  readonly displayName: "Olive Blessed Crest Academy";
  readonly publicationRights: "pending";
  readonly brand: Readonly<SchoolThemeInputs>;
  readonly theme: Readonly<SchoolThemeDerivation>;
  readonly assets: Readonly<Record<ReviewAssetKey, string>>;
  readonly application: ApplicationLinkV1 | null;
}

export function validatePrivateReviewFixture(input: {
  kind: string;
  rendererKey: string;
  schemaVersion: number;
  displayName: string;
  publicationRights: string;
  brand: SchoolThemeInputs;
  application: null;
}): PrivateReviewContext {
  if (input.kind !== "private-local-review" || input.rendererKey !== "obhis-v1" || input.schemaVersion !== 1 ||
      input.displayName !== "Olive Blessed Crest Academy" || input.publicationRights !== "pending" ||
      input.application !== null || Object.keys(input.brand).length !== 2 ||
      !normalizeThemeColor(input.brand.primaryColor) || !normalizeThemeColor(input.brand.accentColor)) {
    throw new Error("Invalid private homepage fixture");
  }
  const assets: Record<ReviewAssetKey, string> = {
    "school-logo": "/review/obhis/assets/school-logo",
    "hero-cutout": "/review/obhis/assets/hero-cutout",
    "you-hero": "/review/obhis/assets/you-hero",
    "classroom-moment": "/review/obhis/assets/classroom-moment",
    "school-friends": "/review/obhis/assets/school-friends",
    "classroom-table": "/review/obhis/assets/classroom-table",
    "cultural-day-abuja": "/review/obhis/assets/cultural-day-abuja",
    "cultural-day-rugam": "/review/obhis/assets/cultural-day-rugam",
    "uniform-detail": "/review/obhis/assets/uniform-detail",
  };
  return Object.freeze({
    ...input,
    kind: "private-local-review",
    rendererKey: "obhis-v1",
    schemaVersion: 1,
    displayName: "Olive Blessed Crest Academy",
    publicationRights: "pending",
    brand: Object.freeze({ ...input.brand }),
    theme: Object.freeze(deriveSchoolTheme(input.brand.primaryColor, input.brand.accentColor)),
    assets: Object.freeze(assets),
  });
}

export function privateReviewEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.OBHIS_LOCAL_REVIEW === "1";
}
