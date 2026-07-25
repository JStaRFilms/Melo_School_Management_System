import { getActiveCanonicalDomain, getRedirectTarget, normalizeHostname } from "@/core/domain";
import { isApplicationLinkV1, isSafePortalLink, unavailableApplicationLink } from "@/core/links";
import type { ApprovedPublicAsset, PublicDomainProjection, PublicSiteEnvelope, RendererFieldValue, SiteLoadResult } from "@/core/contracts";

export interface SiteContentSource {
  loadPublished(hostname: string): Promise<unknown | null>;
  loadPreview?(input: { hostname: string; previewToken: string }): Promise<unknown | null>;
}

const fieldKinds = new Set(["text", "rich_text", "boolean", "link_intent", "asset_ref", "string_list"]);
const domainStates = new Set(["requested", "verification_pending", "verified", "routing_pending", "certificate_pending", "ready", "active", "suspended", "retired"]);

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function string(value: unknown, max = 10_000): string | null { return typeof value === "string" && value.length <= max ? value : null; }
function boolean(value: unknown): boolean | null { return typeof value === "boolean" ? value : null; }

function parseField(value: unknown): RendererFieldValue | null {
  const field = object(value); const kind = string(field?.kind, 30);
  if (!field || !kind || !fieldKinds.has(kind)) return null;
  if (kind === "text") { const text = string(field.value); return text === null ? null : { kind: "text", value: text }; }
  if (kind === "rich_text") { const text = string(field.value); return text === null ? null : { kind: "rich_text", value: text }; }
  if (kind === "boolean") { const flag = boolean(field.value); return flag === null ? null : { kind: "boolean", value: flag }; }
  if (kind === "asset_ref") { const assetId = string(field.assetId, 200); return assetId ? { kind: "asset_ref", assetId } : null; }
  if (kind === "string_list") {
    if (!Array.isArray(field.value) || field.value.length > 100 || !field.value.every((item) => string(item, 1000) !== null)) return null;
    return { kind: "string_list", value: field.value as string[] };
  }
  const intent = object(field.value); const intentKind = string(intent?.kind, 40);
  if (!intentKind || !["admissions_info", "application", "portal", "contact", "visit", "reviewed_external"].includes(intentKind)) return null;
  if (intentKind === "application") return typeof intent?.intakeSlug === "string" ? { kind: "link_intent", value: { kind: "application", intakeSlug: intent.intakeSlug } } : { kind: "link_intent", value: { kind: "application" } };
  if (intentKind === "reviewed_external") return typeof intent?.linkId === "string" ? { kind: "link_intent", value: { kind: "reviewed_external", linkId: intent.linkId } } : null;
  if (intentKind === "admissions_info" || intentKind === "portal" || intentKind === "contact" || intentKind === "visit") return { kind: "link_intent", value: { kind: intentKind } };
  return null;
}

function parseDomains(value: unknown): PublicDomainProjection[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const parsed = value.map((item) => {
    const domain = object(item); const hostname = normalizeHostname(string(domain?.hostname, 255)); const id = string(domain?.id, 200); const status = string(domain?.status, 40);
    if (!hostname || !id || !status || !domainStates.has(status) || (domain?.canonicalIntent !== "canonical" && domain?.canonicalIntent !== "redirect")) return null;
    return { id, hostname, status: status as PublicDomainProjection["status"], canonicalIntent: domain.canonicalIntent, canonicalDomainId: typeof domain.canonicalDomainId === "string" ? domain.canonicalDomainId : undefined };
  });
  return parsed.every(Boolean) ? parsed as PublicDomainProjection[] : null;
}

function parseAssets(value: unknown, now: number): PublicSiteEnvelope["assets"] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const allowedKinds = new Set(["logo", "favicon", "hero", "gallery", "staff", "facility", "document", "social_share"]);
  const output: Array<PublicSiteEnvelope["assets"][number]> = [];
  for (const item of value) {
    const asset = object(item); const id = string(asset?.id, 200); const url = string(asset?.url, 4000); const kind = string(asset?.kind, 30);
    if (!id || !url || !kind || !allowedKinds.has(kind) || asset?.rightsStatus !== "approved" || asset?.status !== "published" || boolean(asset.decorative) === null) return null;
    try { const parsedUrl = new URL(url); if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null; } catch { return null; }
    const expiresAt = typeof asset.rightsExpiresAt === "number" ? asset.rightsExpiresAt : undefined;
    if (expiresAt !== undefined && expiresAt <= now) continue;
    output.push({ id, url, kind: kind as ApprovedPublicAsset["kind"], decorative: Boolean(asset.decorative), altText: typeof asset.altText === "string" ? asset.altText : undefined, rightsStatus: "approved", status: "published", rightsExpiresAt: expiresAt });
  }
  return output;
}

export function parsePublicSiteEnvelope(value: unknown, now = Date.now()): PublicSiteEnvelope | null {
  const root = object(value); const profile = object(root?.profile); const revision = object(root?.revision);
  if (!root || !profile || !revision || !["managed", "external", "none"].includes(String(profile.mode)) || !["draft", "review", "published", "suspended", "retired"].includes(String(profile.status))) return null;
  const schoolId = string(profile.schoolId, 200); const schoolSlug = string(profile.schoolSlug, 160); const rendererKey = string(profile.rendererKey, 100); const rendererSchemaVersion = string(profile.rendererSchemaVersion, 100); const canonicalDomainId = string(profile.canonicalDomainId, 200);
  const revisionId = string(revision.id, 200); const revisionRendererKey = string(revision.rendererKey, 100); const revisionSchema = string(revision.rendererSchemaVersion, 100);
  if (!schoolId || !schoolSlug || !revisionId || !revisionRendererKey || !revisionSchema || !isApplicationLinkV1(root.links && object(root.links)?.application)) return null;
  const domains = parseDomains(root.domains); const assets = parseAssets(root.assets, now); const rawFields = object(revision.fields); const rawSeo = object(revision.routeSeo);
  if (!domains || !assets || !rawFields || !rawSeo) return null;
  const fields: Record<string, RendererFieldValue> = {};
  for (const [key, item] of Object.entries(rawFields)) { if (!/^[a-z0-9._-]{1,120}$/i.test(key)) return null; const field = parseField(item); if (!field) return null; fields[key] = field; }
  const routeSeo: Record<string, { title?: string; description?: string; shareAssetId?: string }> = {};
  for (const [key, item] of Object.entries(rawSeo)) { const seo = object(item); if (!/^[a-z0-9._-]{1,120}$/i.test(key) || !seo) return null; const title = seo.title === undefined ? undefined : string(seo.title, 120); const description = seo.description === undefined ? undefined : string(seo.description, 300); const shareAssetId = seo.shareAssetId === undefined ? undefined : string(seo.shareAssetId, 200); if ((seo.title !== undefined && title === null) || (seo.description !== undefined && description === null) || (seo.shareAssetId !== undefined && shareAssetId === null)) return null; routeSeo[key] = { ...(title ? { title } : {}), ...(description ? { description } : {}), ...(shareAssetId ? { shareAssetId } : {}) }; }
  const portal = object(root.links)?.portal;
  return { profile: { schoolId, schoolSlug, mode: profile.mode as PublicSiteEnvelope["profile"]["mode"], status: profile.status as PublicSiteEnvelope["profile"]["status"], rendererKey: rendererKey ?? undefined, rendererSchemaVersion: rendererSchemaVersion ?? undefined, canonicalDomainId: canonicalDomainId ?? undefined }, domains, revision: { id: revisionId, state: revision.state === "draft" ? "draft" : "published", rendererKey: revisionRendererKey, rendererSchemaVersion: revisionSchema, publishedAt: typeof revision.publishedAt === "number" ? revision.publishedAt : undefined, fields, routeSeo }, assets, links: { application: object(root.links)!.application as unknown as ReturnType<typeof unavailableApplicationLink>, ...(isSafePortalLink(portal) ? { portal } : {}) }, ...(root.preview && object(root.preview)?.authorized === true && typeof object(root.preview)?.expiresAt === "number" ? { preview: { authorized: true, expiresAt: object(root.preview)!.expiresAt as number } } : {}) };
}

function validateLoadedSite(site: PublicSiteEnvelope, hostname: string, preview: boolean, now: number): SiteLoadResult {
  const unavailable = (reason: "unknown_host" | "inactive_domain" | "unpublished" | "invalid_content" | "unauthorized_preview"): SiteLoadResult => ({ status: "unavailable", reason });
  if (site.profile.mode !== "managed" || site.profile.status !== "published") return unavailable("unpublished");
  if (!preview && site.revision.state !== "published") return unavailable("unpublished");
  if (preview && (!site.preview || site.preview.expiresAt <= now)) return unavailable("unauthorized_preview");
  if (!site.profile.rendererKey || !site.profile.rendererSchemaVersion || site.revision.rendererKey !== site.profile.rendererKey || site.revision.rendererSchemaVersion !== site.profile.rendererSchemaVersion) return unavailable("invalid_content");
  const matched = site.domains.find((domain) => domain.hostname === hostname);
  const canonical = getActiveCanonicalDomain(site.domains, site.profile.canonicalDomainId);
  if (!matched || !canonical || matched.status !== "active") return unavailable("inactive_domain");
  return { status: "available", site, canonicalDomain: canonical, redirectToHostname: getRedirectTarget(matched, canonical), preview };
}

export async function loadSite(input: { hostname: string | null; source: SiteContentSource; previewToken?: string; now?: number }): Promise<SiteLoadResult> {
  const hostname = normalizeHostname(input.hostname); const now = input.now ?? Date.now();
  if (!hostname) return { status: "unavailable", reason: "unknown_host" };
  const raw = input.previewToken && input.source.loadPreview ? await input.source.loadPreview({ hostname, previewToken: input.previewToken }) : await input.source.loadPublished(hostname);
  const site = raw ? parsePublicSiteEnvelope(raw, now) : null;
  return site ? validateLoadedSite(site, hostname, Boolean(input.previewToken), now) : { status: "unavailable", reason: input.previewToken ? "unauthorized_preview" : "unknown_host" };
}
