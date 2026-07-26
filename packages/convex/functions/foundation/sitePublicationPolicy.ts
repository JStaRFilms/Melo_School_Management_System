import { ConvexError } from "convex/values";

export const MANAGED_RENDERERS = {
  "obhis-v1": {
    schemaVersion: "1",
    routeIds: ["home", "about", "programmes", "admissions", "school-life", "visit", "contact", "policy-index", "policy-detail"],
  },
} as const;

const MAX_TEXT_LENGTH = 1_200;
const fieldRules: ReadonlyArray<{ pattern: RegExp; kinds: readonly string[]; approvalClass: "standard" | "sensitive_public" | "identity"; maxItems?: number }> = [
  { pattern: /^identity\.(displayName|shortName|motto)$/, kinds: ["text"], approvalClass: "identity" },
  { pattern: /^brand\.(logo|favicon)$/, kinds: ["asset_ref"], approvalClass: "identity" },
  { pattern: /^(home\.(hero\.(eyebrow|heading|summary)|values\.lead)|about\.lead|schoolLife\.lead)$/, kinds: ["text", "rich_text"], approvalClass: "standard" },
  { pattern: /^home\.hero\.asset$/, kinds: ["asset_ref"], approvalClass: "standard" },
  { pattern: /^about\.(values|story)\.ids$/, kinds: ["string_list"], approvalClass: "standard", maxItems: 4 },
  { pattern: /^about\.(values|story)\.[a-z0-9]+(?:-[a-z0-9]+)*\.(title|body)$/, kinds: ["text", "rich_text"], approvalClass: "standard" },
  { pattern: /^programmes\.ids$/, kinds: ["string_list"], approvalClass: "sensitive_public", maxItems: 8 },
  { pattern: /^programmes\.[a-z0-9]+(?:-[a-z0-9]+)*\.(name|descriptor|summary)$/, kinds: ["text", "rich_text"], approvalClass: "sensitive_public" },
  { pattern: /^programmes\.[a-z0-9]+(?:-[a-z0-9]+)*\.asset$/, kinds: ["asset_ref"], approvalClass: "sensitive_public" },
  { pattern: /^admissions\.(lead|questionsCopy)$/, kinds: ["text", "rich_text"], approvalClass: "sensitive_public" },
  { pattern: /^admissions\.steps$/, kinds: ["string_list"], approvalClass: "sensitive_public", maxItems: 4 },
  // Gallery media is a typed asset list. It is never accepted through a generic
  // string list, even when a caller happens to supply valid-looking IDs.
  { pattern: /^schoolLife\.gallery$/, kinds: ["asset_list"], approvalClass: "sensitive_public", maxItems: 12 },
  { pattern: /^schoolLife\.features\.ids$/, kinds: ["string_list"], approvalClass: "standard", maxItems: 6 },
  { pattern: /^schoolLife\.features\.[a-z0-9]+(?:-[a-z0-9]+)*\.(title|body)$/, kinds: ["text", "rich_text"], approvalClass: "standard" },
  { pattern: /^(visit\.lead|contact\.(directions|hours|phone|email|address(?:\.(streetAddress|locality|region|postalCode|country))?))$/, kinds: ["text", "rich_text"], approvalClass: "sensitive_public" },
  { pattern: /^policies\.ids$/, kinds: ["string_list"], approvalClass: "sensitive_public", maxItems: 20 },
  { pattern: /^policies\.[a-z0-9]+(?:-[a-z0-9]+)*\.(title|summary|issued|reviewed)$/, kinds: ["text", "rich_text"], approvalClass: "sensitive_public" },
  { pattern: /^policies\.[a-z0-9]+(?:-[a-z0-9]+)*\.asset$/, kinds: ["asset_ref"], approvalClass: "sensitive_public" },
];

export type SiteField = { fieldId: string; value: { kind: string; value?: unknown; assetId?: unknown; assetIds?: unknown } };
export type RouteSeo = { routeId: string; title?: string; description?: string; shareAssetId?: unknown };
export type SiteAssetKind = "logo" | "favicon" | "hero" | "gallery" | "staff" | "facility" | "document" | "social_share";

export function getRendererPolicy(rendererKey: string, schemaVersion: string) {
  const policy = MANAGED_RENDERERS[rendererKey as keyof typeof MANAGED_RENDERERS];
  return policy?.schemaVersion === schemaVersion ? policy : null;
}

export function fieldApprovalClass(fieldId: string) {
  return fieldRules.find((rule) => rule.pattern.test(fieldId))?.approvalClass ?? null;
}

export function assetApprovalClass(asset: { kind: string }): "standard" | "sensitive_public" {
  return ["gallery", "facility", "staff"].includes(asset.kind) ? "sensitive_public" : "standard";
}

export function assertRendererContent(rendererKey: string, schemaVersion: string, content: { fields: readonly SiteField[]; routeSeo: readonly RouteSeo[] }) {
  const policy = getRendererPolicy(rendererKey, schemaVersion);
  if (!policy) throw new ConvexError("Unsupported site renderer or schema version");
  if (content.fields.length > 300 || content.routeSeo.length > policy.routeIds.length) throw new ConvexError("Site content exceeds the publication limit");
  const fieldIds = new Set<string>();
  for (const field of content.fields) {
    const rule = fieldRules.find((candidate) => candidate.pattern.test(field.fieldId));
    if (!rule || fieldIds.has(field.fieldId) || !rule.kinds.includes(field.value.kind)) throw new ConvexError("Content field is not allowed by this renderer");
    fieldIds.add(field.fieldId);
    if ((field.value.kind === "text" || field.value.kind === "rich_text")) {
      const value = field.value.value;
      if (typeof value !== "string" || !value.trim() || value.length > MAX_TEXT_LENGTH || /[<>]/.test(value)) throw new ConvexError("Invalid published text value");
    }
    if (field.value.kind === "string_list") {
      const values = field.value.value;
      if (!Array.isArray(values) || values.length > (rule.maxItems ?? 20) || values.some((item) => typeof item !== "string" || !item.trim() || item.length > 360 || /[<>]/.test(item))) throw new ConvexError("Invalid published list value");
    }
    if (field.value.kind === "asset_list") {
      const assetIds = field.value.assetIds;
      if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.length > (rule.maxItems ?? 12) || assetIds.some((id) => typeof id !== "string") || new Set(assetIds).size !== assetIds.length) throw new ConvexError("Invalid published asset list");
    }
  }
  const routeIds = new Set<string>();
  for (const seo of content.routeSeo) {
    if (!policy.routeIds.includes(seo.routeId as never) || routeIds.has(seo.routeId) || !seo.title?.trim() || !seo.description?.trim() || seo.title.length > 120 || seo.description.length > 300 || /[<>]/.test(seo.title) || /[<>]/.test(seo.description)) throw new ConvexError("Invalid or incomplete route metadata");
    routeIds.add(seo.routeId);
  }
  for (const routeId of policy.routeIds) if (!routeIds.has(routeId)) throw new ConvexError("Route metadata is required for every renderer route");
  return policy;
}

export function expectedAssetUse(fieldId: string): { kinds: readonly SiteAssetKind[]; purposes: readonly string[]; channel: "site" } | null {
  if (fieldId === "brand.logo") return { kinds: ["logo"], purposes: ["brand_logo"], channel: "site" };
  if (fieldId === "brand.favicon") return { kinds: ["favicon"], purposes: ["browser_icon"], channel: "site" };
  if (fieldId === "home.hero.asset") return { kinds: ["hero"], purposes: ["hero"], channel: "site" };
  if (/^programmes\.[a-z0-9]+(?:-[a-z0-9]+)*\.asset$/.test(fieldId)) return { kinds: ["gallery", "facility"], purposes: ["gallery", "facility"], channel: "site" };
  if (/^policies\.[a-z0-9]+(?:-[a-z0-9]+)*\.asset$/.test(fieldId)) return { kinds: ["document"], purposes: ["policy_document"], channel: "site" };
  return null;
}

export function expectedAssetListUse(fieldId: string): { kinds: readonly SiteAssetKind[]; purposes: readonly string[]; channel: "site" } | null {
  return fieldId === "schoolLife.gallery" ? { kinds: ["gallery"], purposes: ["gallery"], channel: "site" } : null;
}

export function requiresSensitivePublication(content: { fields: readonly SiteField[]; routeSeo: readonly RouteSeo[] }) {
  return content.fields.some((field) => fieldApprovalClass(field.fieldId) !== "standard") || content.routeSeo.some((seo) => Boolean(seo.shareAssetId));
}
