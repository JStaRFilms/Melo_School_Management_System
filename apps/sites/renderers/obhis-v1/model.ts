import { deriveSchoolTheme, type SchoolThemeDerivation } from "@school/shared/theme";
import type { ProductionSiteContext } from "../../core/public";
import { applyDestination } from "../../core/public";

export const oliveAssetKeys = ["school_logo", "hero_cutout", "you_hero", "classroom_moment", "school_friends", "classroom_table", "cultural_day_abuja", "cultural_day_rugam", "uniform_detail"] as const;
export type OliveAssetKey = typeof oliveAssetKeys[number];
export const oliveTextKeys = ["school_name", "short_name", "motto", "intro", "album_heading", "album_intro", "album_day_label", "album_culture_label", "values_heading", "values_intro", "integrity_label", "service_label", "integrity_copy", "service_copy", "campus_heading", "campus_abuja", "campus_rugam", "admissions_heading", "admissions_intro", "visit_address", "application_notice", "contact_intro", "phone", "email", "donations_intro", "caption_friends", "caption_table", "caption_abuja", "caption_rugam"] as const;
export type OliveTextKey = typeof oliveTextKeys[number];
export type OliveModel = {
  readonly text: Readonly<Record<OliveTextKey, string>>;
  readonly assets: Readonly<Record<OliveAssetKey, {src: string; alt: string}>>;
  readonly theme: Readonly<SchoolThemeDerivation>;
  readonly applyHref: string | null;
  readonly privateReview: boolean;
  readonly facebookHref: string | null;
};

/** Call only on an admitted, frozen public DTO. Never project private fixtures here. */
export function oliveFromPublication(site: ProductionSiteContext): OliveModel | null {
  if (site.rendererKey !== "obhis-v1" || site.rendererSchemaVersion !== "1" || !Object.isFrozen(site)) return null;
  const fields = new Map(site.fields.map(field => [field.fieldId, field.value]));
  const text = {} as Record<OliveTextKey, string>;
  const assets = {} as Record<OliveAssetKey, {src: string; alt: string}>;
  for (const key of oliveTextKeys) {
    const value = fields.get(key);
    if (!value || value.kind !== "text") return null;
    text[key] = value.value;
  }
  for (const key of oliveAssetKeys) {
    const value = fields.get(key);
    if (!value || value.kind !== "asset_ref" || value.asset.decorative || !value.asset.altText) return null;
    assets[key] = {src: value.asset.src, alt: value.asset.altText};
  }
  const primary = fields.get("primary_color");
  const accent = fields.get("accent_color");
  if (primary?.kind !== "text" || accent?.kind !== "text") return null;
  return {text, assets, theme: deriveSchoolTheme(primary.value, accent.value), applyHref: applyDestination(site), privateReview: false, facebookHref: null};
}
