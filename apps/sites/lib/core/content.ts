import { getActiveCanonicalDomain, getRedirectTarget, normalizeHostname } from "@/core/domain";
import { isApplicationLinkV1, isSafePortalLink } from "@/core/links";
import type { ApprovedPublicAsset, PublicDomainProjection, PublicSiteEnvelope, RendererFieldValue, SiteLoadResult } from "@/core/contracts";

export interface SiteContentSource {
  loadPublished(hostname: string): Promise<unknown | null>;
  loadPreview?(input: { hostname: string; previewToken: string }): Promise<unknown | null>;
}

const fieldKinds = new Set(["text", "rich_text", "boolean", "link_intent", "asset_ref", "asset_list", "string_list"]);
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
  if (kind === "asset_list") {
    if (!Array.isArray(field.assetIds) || field.assetIds.length === 0 || field.assetIds.length > 12 || !field.assetIds.every((item) => string(item, 200) !== null) || new Set(field.assetIds).size !== field.assetIds.length) return null;
    return { kind: "asset_list", assetIds: field.assetIds as string[] };
  }
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
  const requiredPurpose: Record<string, string> = { logo: "brand_logo", favicon: "browser_icon", hero: "hero", gallery: "gallery", staff: "staff", facility: "facility", document: "policy_document", social_share: "social_share" };
  const allowedChannels = new Set(["site", "social_share"]);
  const output: Array<PublicSiteEnvelope["assets"][number]> = [];
  for (const item of value) {
    const asset = object(item); const id = string(asset?.id, 200); const url = string(asset?.url, 4000); const kind = string(asset?.kind, 30); const purpose = string(asset?.purpose, 30);
    const channels = Array.isArray(asset?.channels) && asset.channels.length > 0 && asset.channels.length <= 2 && asset.channels.every((channel) => typeof channel === "string" && allowedChannels.has(channel)) ? [...new Set(asset.channels)] : null;
    if (!id || !url || !kind || !purpose || !channels || !allowedKinds.has(kind) || requiredPurpose[kind] !== purpose || (kind === "social_share" && !channels.includes("social_share")) || asset?.rightsStatus !== "approved" || asset?.status !== "published" || boolean(asset.decorative) === null) return null;
    try { const parsedUrl = new URL(url); if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null; } catch { return null; }
    const expiresAt = typeof asset.rightsExpiresAt === "number" ? asset.rightsExpiresAt : undefined;
    if (expiresAt !== undefined && expiresAt <= now) continue;
    const width = typeof asset.width === "number" && Number.isInteger(asset.width) && asset.width > 0 && asset.width <= 20_000 ? asset.width : undefined;
    const height = typeof asset.height === "number" && Number.isInteger(asset.height) && asset.height > 0 && asset.height <= 20_000 ? asset.height : undefined;
    if ((asset.width !== undefined && width === undefined) || (asset.height !== undefined && height === undefined) || Boolean(width) !== Boolean(height)) return null;
    const focalPoint = object(asset.focalPoint);
    const focalX = typeof focalPoint?.x === "number" ? focalPoint.x : undefined;
    const focalY = typeof focalPoint?.y === "number" ? focalPoint.y : undefined;
    if ((asset.focalPoint !== undefined && !focalPoint) || (focalPoint && (focalX === undefined || focalY === undefined || focalX < 0 || focalX > 1 || focalY < 0 || focalY > 1))) return null;
    let responsiveSources: Array<{ url: string; width: number }> | undefined;
    if (asset.responsiveSources !== undefined) {
      if (!Array.isArray(asset.responsiveSources) || asset.responsiveSources.length === 0 || asset.responsiveSources.length > 8) return null;
      responsiveSources = [];
      for (const source of asset.responsiveSources) {
        const derivative = object(source); const derivativeUrl = string(derivative?.url, 4000); const derivativeWidth = derivative?.width;
        if (!derivativeUrl || typeof derivativeWidth !== "number" || !Number.isInteger(derivativeWidth) || derivativeWidth <= 0 || derivativeWidth > 20_000) return null;
        try { const parsedUrl = new URL(derivativeUrl); if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return null; } catch { return null; }
        responsiveSources.push({ url: derivativeUrl, width: derivativeWidth });
      }
    }
    const caption = asset.caption === undefined ? undefined : string(asset.caption, 600);
    const credit = asset.credit === undefined ? undefined : string(asset.credit, 300);
    if (caption === null || credit === null || (asset.decorative === true && asset.altText !== undefined)) return null;
    output.push({ id, url, kind: kind as ApprovedPublicAsset["kind"], purpose: purpose as ApprovedPublicAsset["purpose"], channels: channels as ApprovedPublicAsset["channels"], decorative: Boolean(asset.decorative), altText: typeof asset.altText === "string" ? asset.altText : undefined, ...(caption ? { caption } : {}), ...(credit ? { credit } : {}), ...(width && height ? { width, height } : {}), ...(focalX !== undefined && focalY !== undefined ? { focalPoint: { x: focalX, y: focalY } } : {}), ...(responsiveSources ? { responsiveSources } : {}), rightsStatus: "approved", status: "published", rightsExpiresAt: expiresAt });
  }
  return output;
}

export function parsePublicSiteEnvelope(value: unknown, now = Date.now()): PublicSiteEnvelope | null {
  const root = object(value); const profile = object(root?.profile); const revision = object(root?.revision);
  if (!root || !profile || !revision || !["managed", "external", "none"].includes(String(profile.mode)) || !["draft", "review", "published", "suspended", "retired"].includes(String(profile.status))) return null;
  const schoolId = string(profile.schoolId, 200); const schoolSlug = string(profile.schoolSlug, 160); const rendererKey = string(profile.rendererKey, 100); const rendererSchemaVersion = string(profile.rendererSchemaVersion, 100); const canonicalDomainId = string(profile.canonicalDomainId, 200);
  const revisionId = string(revision.id, 200); const revisionRendererKey = string(revision.rendererKey, 100); const revisionSchema = string(revision.rendererSchemaVersion, 100);
  const links = object(root.links); const application = links?.application;
  if (!schoolId || !schoolSlug || !revisionId || !revisionRendererKey || !revisionSchema || (revision.state !== "draft" && revision.state !== "published") || !isApplicationLinkV1(application) || application.schoolSlug !== schoolSlug) return null;
  const domains = parseDomains(root.domains); const assets = parseAssets(root.assets, now); const rawFields = object(revision.fields); const rawSeo = object(revision.routeSeo);
  if (!domains || !assets || !rawFields || !rawSeo) return null;
  const fields: Record<string, RendererFieldValue> = {};
  for (const [key, item] of Object.entries(rawFields)) { if (!/^[a-z0-9._-]{1,120}$/i.test(key)) return null; const field = parseField(item); if (!field) return null; fields[key] = field; }
  const routeSeo: Record<string, { title?: string; description?: string; shareAssetId?: string }> = {};
  for (const [key, item] of Object.entries(rawSeo)) { const seo = object(item); if (!/^[a-z0-9._-]{1,120}$/i.test(key) || !seo) return null; const title = seo.title === undefined ? undefined : string(seo.title, 120); const description = seo.description === undefined ? undefined : string(seo.description, 300); const shareAssetId = seo.shareAssetId === undefined ? undefined : string(seo.shareAssetId, 200); if ((seo.title !== undefined && title === null) || (seo.description !== undefined && description === null) || (seo.shareAssetId !== undefined && shareAssetId === null)) return null; routeSeo[key] = { ...(title ? { title } : {}), ...(description ? { description } : {}), ...(shareAssetId ? { shareAssetId } : {}) }; }
  // Social metadata may only use an asset explicitly approved for social sharing.
  for (const seo of Object.values(routeSeo)) {
    if (!seo.shareAssetId) continue;
    const shareAsset = assets.find((asset) => asset.id === seo.shareAssetId);
    if (!shareAsset || shareAsset.kind !== "social_share" || !shareAsset.channels.includes("social_share")) return null;
  }
  const portal = links?.portal;
  return { profile: { schoolId, schoolSlug, mode: profile.mode as PublicSiteEnvelope["profile"]["mode"], status: profile.status as PublicSiteEnvelope["profile"]["status"], rendererKey: rendererKey ?? undefined, rendererSchemaVersion: rendererSchemaVersion ?? undefined, canonicalDomainId: canonicalDomainId ?? undefined }, domains, revision: { id: revisionId, state: revision.state, rendererKey: revisionRendererKey, rendererSchemaVersion: revisionSchema, publishedAt: typeof revision.publishedAt === "number" ? revision.publishedAt : undefined, fields, routeSeo }, assets, links: { application, ...(isSafePortalLink(portal) ? { portal } : {}) }, ...(root.preview && object(root.preview)?.authorized === true && typeof object(root.preview)?.expiresAt === "number" ? { preview: { authorized: true, expiresAt: object(root.preview)!.expiresAt as number } } : {}) };
}

function validateLoadedSite(site: PublicSiteEnvelope, hostname: string, preview: boolean, now: number): SiteLoadResult {
  const unavailable = (reason: "unknown_host" | "inactive_domain" | "unpublished" | "invalid_content" | "unauthorized_preview"): SiteLoadResult => ({ status: "unavailable", reason });
  if (site.profile.mode !== "managed") return unavailable("unpublished");
  if (!site.profile.rendererKey || !site.profile.rendererSchemaVersion || site.revision.rendererKey !== site.profile.rendererKey || site.revision.rendererSchemaVersion !== site.profile.rendererSchemaVersion) return unavailable("invalid_content");
  const matched = site.domains.find((domain) => domain.hostname === hostname);

  if (preview) {
    if (!site.preview || site.preview.expiresAt <= now) return unavailable("unauthorized_preview");
    if (!["draft", "review", "published"].includes(site.profile.status) || !matched || ["suspended", "retired"].includes(matched.status)) return unavailable("unpublished");
    // An authorized preview may use a pending domain; it never redirects or becomes canonical.
    return { status: "available", site, canonicalDomain: matched, preview: true };
  }

  if (site.profile.status !== "published" || site.revision.state !== "published") return unavailable("unpublished");
  if (!Number.isFinite(site.revision.publishedAt) || (site.revision.publishedAt ?? 0) <= 0) return unavailable("invalid_content");
  const canonical = getActiveCanonicalDomain(site.domains, site.profile.canonicalDomainId);
  if (!matched || !canonical || matched.status !== "active") return unavailable("inactive_domain");
  const isCanonicalHost = matched.id === canonical.id;
  const isValidAlias = matched.canonicalIntent === "redirect" && matched.canonicalDomainId === canonical.id;
  if (!isCanonicalHost && !isValidAlias) return unavailable("inactive_domain");
  return { status: "available", site, canonicalDomain: canonical, redirectToHostname: isCanonicalHost ? undefined : getRedirectTarget(matched, canonical), preview: false };
}

export async function loadSite(input: { hostname: string | null; source: SiteContentSource; previewToken?: string; now?: number }): Promise<SiteLoadResult> {
  const hostname = normalizeHostname(input.hostname); const now = input.now ?? Date.now();
  if (!hostname) return { status: "unavailable", reason: "unknown_host" };
  const preview = Boolean(input.previewToken);
  // Availability and the published-revision pointer are mutable B0 projections.
  // Do not retain them in process memory: a close, publish, or revert must be
  // observable on the next request even if an invalidation hook is delayed.
  const raw = preview && input.source.loadPreview ? await input.source.loadPreview({ hostname, previewToken: input.previewToken! }) : await input.source.loadPublished(hostname);
  const site = raw ? parsePublicSiteEnvelope(raw, now) : null;
  return site ? validateLoadedSite(site, hostname, preview, now) : { status: "unavailable", reason: preview ? "unauthorized_preview" : "unknown_host" };
}
