import type { ApplicationLinkV1 } from "./admissions-foundation";

export type SiteFieldValueV1 =
  | { kind: "text" | "rich_text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "string_list"; value: string[] }
  | { kind: "asset_ref"; assetId: string }
  | { kind: "link_intent"; value: { kind: "admissions_info" | "portal" | "contact" | "visit" } | { kind: "application"; intakeSlug?: string } | { kind: "reviewed_external"; linkId: string } };
export type SiteContentV1 = {
  fields: { fieldId: string; value: SiteFieldValueV1 }[];
  routeSeo: { routeId: string; title?: string; description?: string; shareAssetId?: string }[];
};
export type SiteEvidenceClass = "identity" | "sensitive_public";
export type SiteManifestV1 = Readonly<{
  rendererKey: string;
  schemaVersion: string;
  routes: readonly Readonly<{ routeId: string; path: string }>[];
  fields: readonly Readonly<{ fieldId: string; kind: SiteFieldValueV1["kind"]; required: boolean; maxLength?: number; evidence?: SiteEvidenceClass; assetKind?: string }>[];
}>;

// Explicitly selected test renderer. No implicit renderer or OBHIS registration.
export const SITE_MANIFESTS_V1: readonly SiteManifestV1[] = Object.freeze([{
  rendererKey: "school-core-synthetic-v1", schemaVersion: "1",
  routes: [{ routeId: "home", path: "/" }, { routeId: "about", path: "/about" }, { routeId: "contact", path: "/contact" }],
  fields: [
    { fieldId: "school_name", kind: "text", required: true, maxLength: 120, evidence: "identity" },
    { fieldId: "intro", kind: "text", required: true, maxLength: 1000 },
    { fieldId: "hero_image", kind: "asset_ref", required: false, assetKind: "hero" },
  ],
}]);

export function siteManifest(rendererKey: string, version: string): SiteManifestV1 | null {
  return SITE_MANIFESTS_V1.find(m => m.rendererKey === rendererKey && m.schemaVersion === version) ?? null;
}

// Pure descriptor lookup. Production callers supply only the manifest selected by siteManifest.
export function routeIdAtPath(manifest: Pick<SiteManifestV1,"routes">, path: string): string | null {
  if (typeof path !== "string" || path.length > 1024 || !path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u001f\u007f%?#]/.test(path) || path.split("/").some(segment => segment === "." || segment === "..")) return null;
  return manifest.routes.find(route => route.path === path)?.routeId ?? null;
}

function plainText(value: string, max: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value &&
    !/[<>\u0000-\u001f\u007f]/u.test(value) && !/\b(?:javascript:|data:|url\s*\(|@import|<script|<style)\b/iu.test(value);
}
function exact(value: object, keys: readonly string[]): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(k => keys.includes(k));
}
export function validateSiteContent(content: SiteContentV1, manifest: SiteManifestV1): void {
  if (!content || !exact(content, ["fields", "routeSeo"]) || !Array.isArray(content.fields) || !Array.isArray(content.routeSeo) ||
      content.fields.length > manifest.fields.length || content.routeSeo.length > manifest.routes.length) throw Error("Invalid site content");
  const seen = new Set<string>();
  for (const field of content.fields) {
    const def = manifest.fields.find(f => f.fieldId === field.fieldId);
    if (!def || seen.has(field.fieldId) || !exact(field, ["fieldId", "value"]) || !field.value || field.value.kind !== def.kind) throw Error("Invalid site field");
    seen.add(field.fieldId);
    const value = field.value;
    if (value.kind === "text" || value.kind === "rich_text") {
      // No renderer currently registers rich text. Future manifests must add an AST parser first.
      if (value.kind === "rich_text" || !exact(value, ["kind", "value"]) || !plainText(value.value, def.maxLength ?? 500)) throw Error("Invalid site text");
    } else if (value.kind === "asset_ref") {
      if (!exact(value, ["kind", "assetId"]) || !def.assetKind || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.assetId)) throw Error("Invalid asset reference");
    } else if (value.kind === "boolean") {
      if (!exact(value, ["kind", "value"]) || typeof value.value !== "boolean") throw Error("Invalid boolean");
    } else if (value.kind === "string_list") {
      if (!exact(value, ["kind", "value"]) || !Array.isArray(value.value) || value.value.length > 12 || !value.value.every(v => typeof v === "string" && plainText(v, def.maxLength ?? 120))) throw Error("Invalid list");
    } else if (value.kind === "link_intent") {
      if (!exact(value, ["kind", "value"]) || !value.value || !["admissions_info", "application", "portal", "contact", "visit", "reviewed_external"].includes(value.value.kind)) throw Error("Invalid intent");
      const intent = value.value;
      if (intent.kind === "application") {
        if (!exact(intent, ["kind", "intakeSlug"]) || (intent.intakeSlug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(intent.intakeSlug))) throw Error("Invalid intake");
      } else if (intent.kind === "reviewed_external") {
        // No registered manifest accepts external links without a reviewed-link resolver.
        throw Error("External links are unavailable");
      } else if (!exact(intent, ["kind"])) throw Error("Invalid intent fields");
    }
  }
  if (manifest.fields.some(f => f.required && !seen.has(f.fieldId))) throw Error("Missing required field");
  const routes = new Set<string>();
  for (const seo of content.routeSeo) {
    if (!manifest.routes.some(r => r.routeId === seo.routeId) || routes.has(seo.routeId) || !exact(seo, ["routeId", "title", "description", "shareAssetId"]) ||
      (seo.title !== undefined && !plainText(seo.title, 120)) || (seo.description !== undefined && !plainText(seo.description, 300)) ||
      (seo.shareAssetId !== undefined && !/^[a-zA-Z0-9_-]{8,100}$/.test(seo.shareAssetId))) throw Error("Invalid route SEO");
    routes.add(seo.routeId);
  }
}

export function canonicalSiteFieldValue(value: SiteFieldValueV1): string {
  if (value.kind === "asset_ref") return JSON.stringify({kind: value.kind, assetId: value.assetId});
  if (value.kind === "link_intent") {
    const intent = value.value;
    return JSON.stringify({kind: value.kind, value: intent.kind === "application" ? {kind: intent.kind, ...(intent.intakeSlug === undefined ? {} : {intakeSlug: intent.intakeSlug})} : intent.kind === "reviewed_external" ? {kind: intent.kind, linkId: intent.linkId} : {kind: intent.kind}});
  }
  return JSON.stringify({kind: value.kind, value: value.value});
}
export function canonicalSiteContent(content: SiteContentV1): string {
  return JSON.stringify({
    fields: [...content.fields].sort((a,b) => a.fieldId.localeCompare(b.fieldId)).map(field => ({fieldId: field.fieldId, value: JSON.parse(canonicalSiteFieldValue(field.value))})),
    routeSeo: [...content.routeSeo].sort((a,b) => a.routeId.localeCompare(b.routeId)).map(seo => ({routeId: seo.routeId, title: seo.title, description: seo.description, shareAssetId: seo.shareAssetId})),
  });
}

export type PublicAssetV1 = { id: string; src: string; kind: "logo" | "favicon" | "hero" | "gallery" | "staff" | "facility" | "document" | "social_share"; altText?: string; decorative: boolean };
export type PublicFieldValueV1 = { kind: "text" | "rich_text"; value: string } | { kind: "boolean"; value: boolean } | { kind: "string_list"; value: readonly string[] } | { kind: "asset_ref"; asset: PublicAssetV1 } | { kind: "link_intent"; intent: string; href: string | null };
export type PublicSiteV1 = { version: "1"; schoolSlug: string; rendererKey: string; rendererSchemaVersion: string; revisionId: string; publishedAt: number; canonicalOrigin: string; activeHostname: string; redirectToCanonical: boolean; routeIds: readonly string[]; fields: readonly { fieldId: string; value: PublicFieldValueV1 }[]; routeSeo: readonly { routeId: string; title?: string; description?: string; shareAsset?: PublicAssetV1 }[]; applicationLink: ApplicationLinkV1; portal: { availability: "unavailable" } | { availability: "available"; href: string } };
export type PreviewSiteV1 = { status: "preview"; watermark: "Draft - not public"; robots: "noindex,nofollow"; canonical: null; sitemap: null; fields: readonly { fieldId: string; value: SiteFieldValueV1 | { kind: "asset_placeholder"; message: string } }[]; routeSeo: readonly { routeId: string; title?: string; description?: string }[] };
