import { v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

function normalizeHostname(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) ? host : null;
}

function contentAssetIds(content: { fields: readonly { value: { kind: string; assetId?: Id<"schoolSiteAssets"> } }[]; routeSeo: readonly { shareAssetId?: Id<"schoolSiteAssets"> }[] }) {
  const ids = new Set<Id<"schoolSiteAssets">>();
  for (const field of content.fields) if (field.value.kind === "asset_ref" && field.value.assetId) ids.add(field.value.assetId);
  for (const route of content.routeSeo) if (route.shareAssetId) ids.add(route.shareAssetId);
  return ids;
}

function fieldProjection(content: { fields: readonly { fieldId: string; value: unknown }[]; routeSeo: readonly { routeId: string; title?: string; description?: string; shareAssetId?: Id<"schoolSiteAssets"> }[] }) {
  return {
    fields: Object.fromEntries(content.fields.map((field) => [field.fieldId, field.value])),
    routeSeo: Object.fromEntries(content.routeSeo.map((route) => [route.routeId, { ...(route.title ? { title: route.title } : {}), ...(route.description ? { description: route.description } : {}), ...(route.shareAssetId ? { shareAssetId: String(route.shareAssetId) } : {}) }])),
  };
}

async function approvedAssetProjection(ctx: QueryCtx, schoolId: Id<"schools">, revision: { content: { fields: readonly { value: { kind: string; assetId?: Id<"schoolSiteAssets"> } }[]; routeSeo: readonly { shareAssetId?: Id<"schoolSiteAssets"> }[] } }) {
  const now = Date.now();
  const assets = [];
  for (const assetId of contentAssetIds(revision.content)) {
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.schoolId !== schoolId || asset.status !== "published" || asset.rightsStatus !== "approved" || (asset.rightsExpiresAt && asset.rightsExpiresAt <= now) || !asset.purpose || !asset.channels?.length) return null;
    const url = await ctx.storage.getUrl(asset.storageId);
    if (!url) return null;
    assets.push({ id: String(asset._id), url, kind: asset.kind, purpose: asset.purpose, channels: asset.channels, decorative: asset.decorative, ...(asset.altText ? { altText: asset.altText } : {}), ...(asset.caption ? { caption: asset.caption } : {}), ...(asset.credit ? { credit: asset.credit } : {}), ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), rightsStatus: "approved" as const, status: "published" as const, ...(asset.rightsExpiresAt ? { rightsExpiresAt: asset.rightsExpiresAt } : {}) });
  }
  return assets;
}

async function projectRevision(ctx: QueryCtx, domain: { _id: Id<"schoolDomains">; schoolId: Id<"schools">; hostname: string; status: string; canonicalIntent: string; canonicalDomainId?: Id<"schoolDomains"> }, revisionId: Id<"schoolSiteRevisions">, preview: { expiresAt: number } | null) {
  const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique();
  const school = await ctx.db.get(domain.schoolId);
  const revision = await ctx.db.get(revisionId);
  if (!profile || !school || !revision || revision.schoolId !== domain.schoolId || profile.mode !== "managed" || !profile.rendererKey || !profile.rendererSchemaVersion || revision.rendererKey !== profile.rendererKey || revision.rendererSchemaVersion !== profile.rendererSchemaVersion) return null;
  const assets = await approvedAssetProjection(ctx, domain.schoolId, revision);
  if (!assets) return null;
  const application: { version: "1"; schoolSlug: string; href: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; intakeSlug: string | null; opensAt: number | null; closesAt: number | null } = await ctx.runQuery(api.functions.foundation.applicationLinks.getApplicationLink, { schoolSlug: school.slug });
  const domains = preview
    ? [{ id: String(domain._id), hostname: domain.hostname, status: domain.status, canonicalIntent: domain.canonicalIntent, ...(domain.canonicalDomainId ? { canonicalDomainId: String(domain.canonicalDomainId) } : {}) }]
    : (await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", domain.schoolId).eq("surface", "public").eq("status", "active")).take(20)).map((item) => ({ id: String(item._id), hostname: item.hostname, status: item.status, canonicalIntent: item.canonicalIntent, ...(item.canonicalDomainId ? { canonicalDomainId: String(item.canonicalDomainId) } : {}) }));
  const content = fieldProjection(revision.content);
  return {
    profile: { schoolId: String(domain.schoolId), schoolSlug: school.slug, mode: profile.mode, status: preview ? profile.status : "published", rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, ...(profile.canonicalDomainId ? { canonicalDomainId: String(profile.canonicalDomainId) } : {}) },
    domains,
    revision: { id: String(revision._id), state: revision.state, rendererKey: revision.rendererKey, rendererSchemaVersion: revision.rendererSchemaVersion, ...(revision.publishedAt ? { publishedAt: revision.publishedAt } : {}), ...content },
    assets,
    links: { application },
    ...(preview ? { preview: { authorized: true as const, expiresAt: preview.expiresAt } } : {}),
  };
}

/** Unauthenticated but intentionally minimal: only an active hostname's immutable publication. */
export const getPublishedProjection = query({
  args: { hostname: v.string() },
  handler: async (ctx, args) => {
    const hostname = normalizeHostname(args.hostname);
    if (!hostname) return null;
    const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique();
    if (!domain || domain.status !== "active") return null;
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique();
    const canonical = profile?.canonicalDomainId ? await ctx.db.get(profile.canonicalDomainId) : null;
    if (!profile || profile.status !== "published" || !canonical || canonical.schoolId !== domain.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical" || !profile.publishedRevisionId) return null;
    return await projectRevision(ctx, domain, profile.publishedRevisionId, null);
  },
});

/** Opaque preview hash lookup. The hash is produced server-side by the projection HTTP adapter. */
export const getPreviewProjection = query({
  args: { hostname: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const hostname = normalizeHostname(args.hostname);
    if (!hostname || !/^[a-f0-9]{64}$/i.test(args.tokenHash)) return null;
    const token = await ctx.db.query("schoolSitePreviewTokens").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash.toLowerCase())).unique();
    if (!token || token.hostname !== hostname || token.expiresAt <= Date.now() || token.revokedAt) return null;
    const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique();
    if (!domain || domain.schoolId !== token.schoolId || ["suspended", "retired"].includes(domain.status)) return null;
    return await projectRevision(ctx, domain, token.revisionId, { expiresAt: token.expiresAt });
  },
});
