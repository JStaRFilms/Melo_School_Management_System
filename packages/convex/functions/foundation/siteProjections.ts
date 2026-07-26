import { v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { expectedAssetUse, getRendererPolicy } from "./sitePublicationPolicy";

function normalizeHostname(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) ? host : null;
}

function contentAssetIds(content: { fields: readonly { value: { kind: string; assetId?: Id<"schoolSiteAssets">; value?: unknown } }[]; routeSeo: readonly { shareAssetId?: Id<"schoolSiteAssets"> }[] }) {
  const ids = new Set<Id<"schoolSiteAssets">>();
  for (const field of content.fields) {
    if (field.value.kind === "asset_ref" && field.value.assetId) ids.add(field.value.assetId);
    if (field.value.kind === "string_list" && Array.isArray(field.value.value)) for (const id of field.value.value) if (typeof id === "string") ids.add(id as Id<"schoolSiteAssets">);
  }
  for (const route of content.routeSeo) if (route.shareAssetId) ids.add(route.shareAssetId);
  return ids;
}

function fieldProjection(content: { fields: readonly { fieldId: string; value: unknown }[]; routeSeo: readonly { routeId: string; title?: string; description?: string; shareAssetId?: Id<"schoolSiteAssets"> }[] }) {
  return {
    fields: Object.fromEntries(content.fields.map((field) => [field.fieldId, field.value])),
    routeSeo: Object.fromEntries(content.routeSeo.map((route) => [route.routeId, { ...(route.title ? { title: route.title } : {}), ...(route.description ? { description: route.description } : {}), ...(route.shareAssetId ? { shareAssetId: String(route.shareAssetId) } : {}) }])),
  };
}

async function evidenceIsCurrent(ctx: QueryCtx, schoolId: Id<"schools">, evidenceId: Id<"schoolApprovalEvidence"> | undefined) {
  if (!evidenceId) return false;
  const evidence = await ctx.db.get(evidenceId); const now = Date.now();
  return Boolean(evidence && evidence.schoolId === schoolId && !evidence.revokedAt && (!evidence.expiresAt || evidence.expiresAt > now));
}

async function approvedAssetProjection(ctx: QueryCtx, schoolId: Id<"schools">, revision: { approvalEvidenceIds: readonly Id<"schoolApprovalEvidence">[]; content: { fields: readonly { value: { kind: string; assetId?: Id<"schoolSiteAssets">; value?: unknown } }[]; routeSeo: readonly { shareAssetId?: Id<"schoolSiteAssets"> }[] } }) {
  const now = Date.now(); const assets = [];
  for (const assetId of contentAssetIds(revision.content)) {
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.schoolId !== schoolId || asset.status !== "published" || asset.rightsStatus !== "approved" || (asset.rightsExpiresAt && asset.rightsExpiresAt <= now) || !asset.purpose || !asset.channels?.length || !revision.approvalEvidenceIds.some((id) => id === asset.approvalEvidenceId) || !(await evidenceIsCurrent(ctx, schoolId, asset.approvalEvidenceId)) || (asset.decorative ? asset.altText !== undefined : !asset.altText?.trim()) || (asset.caption !== undefined && (!asset.caption.trim() || asset.caption.length > 600)) || (asset.credit !== undefined && (!asset.credit.trim() || asset.credit.length > 300))) return null;
    const url = await ctx.storage.getUrl(asset.storageId); if (!url) return null;
    assets.push({ id: String(asset._id), url, kind: asset.kind, purpose: asset.purpose, channels: asset.channels, decorative: asset.decorative, ...(asset.altText ? { altText: asset.altText } : {}), ...(asset.caption ? { caption: asset.caption } : {}), ...(asset.credit ? { credit: asset.credit } : {}), ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), rightsStatus: "approved" as const, status: "published" as const, ...(asset.rightsExpiresAt ? { rightsExpiresAt: asset.rightsExpiresAt } : {}) });
  }
  return assets;
}

function assetMatches(asset: { kind: string; purpose?: string; channels?: readonly string[] }, use: { kinds: readonly string[]; purposes: readonly string[]; channel: "site" | "social_share" }) {
  return use.kinds.includes(asset.kind) && Boolean(asset.purpose && use.purposes.includes(asset.purpose) && asset.channels?.includes(use.channel));
}

async function currentRevisionIsSafe(ctx: QueryCtx, schoolId: Id<"schools">, revision: { rendererKey: string; rendererSchemaVersion: string; content: { fields: readonly { fieldId: string; value: { kind: string; assetId?: Id<"schoolSiteAssets">; value?: unknown } }[]; routeSeo: readonly { shareAssetId?: Id<"schoolSiteAssets"> }[] }; approvalEvidenceIds: readonly Id<"schoolApprovalEvidence">[] }) {
  if (!getRendererPolicy(revision.rendererKey, revision.rendererSchemaVersion)) return false;
  for (const evidenceId of revision.approvalEvidenceIds) if (!(await evidenceIsCurrent(ctx, schoolId, evidenceId))) return false;
  for (const field of revision.content.fields) {
    if (field.value.kind === "asset_ref") {
      const use = expectedAssetUse(field.fieldId); const asset = field.value.assetId ? await ctx.db.get(field.value.assetId) : null;
      if (!use || !asset || !assetMatches(asset, use)) return false;
    }
    if (field.fieldId === "schoolLife.gallery" && field.value.kind === "string_list" && Array.isArray(field.value.value)) {
      for (const id of field.value.value) { const asset = typeof id === "string" ? await ctx.db.get(id as Id<"schoolSiteAssets">) : null; if (!asset || !assetMatches(asset, { kinds: ["gallery"], purposes: ["gallery"], channel: "site" })) return false; }
    }
  }
  for (const seo of revision.content.routeSeo) if (seo.shareAssetId) { const asset = await ctx.db.get(seo.shareAssetId); if (!asset || !assetMatches(asset, { kinds: ["social_share"], purposes: ["social_share"], channel: "social_share" })) return false; }
  return true;
}

async function projectRevision(ctx: QueryCtx, domain: { _id: Id<"schoolDomains">; schoolId: Id<"schools">; hostname: string; status: string; canonicalIntent: string; canonicalDomainId?: Id<"schoolDomains"> }, revisionId: Id<"schoolSiteRevisions">, preview: { expiresAt: number } | null) {
  const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique();
  const school = await ctx.db.get(domain.schoolId); const revision = await ctx.db.get(revisionId);
  if (!profile || !school || school.status !== "active" || !revision || revision.schoolId !== domain.schoolId || profile.mode !== "managed" || !profile.rendererKey || !profile.rendererSchemaVersion || revision.rendererKey !== profile.rendererKey || revision.rendererSchemaVersion !== profile.rendererSchemaVersion || !(await currentRevisionIsSafe(ctx, domain.schoolId, revision))) return null;
  if (preview ? revision.state !== "draft" : revision.state !== "published" || !revision.publishedAt) return null;
  const assets = await approvedAssetProjection(ctx, domain.schoolId, revision); if (!assets) return null;
  const application: { version: "1"; schoolSlug: string; href: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; intakeSlug: string | null; opensAt: number | null; closesAt: number | null } = await ctx.runQuery(api.functions.foundation.applicationLinks.getApplicationLink, { schoolSlug: school.slug });
  const domains = preview ? [{ id: String(domain._id), hostname: domain.hostname, status: domain.status, canonicalIntent: domain.canonicalIntent, ...(domain.canonicalDomainId ? { canonicalDomainId: String(domain.canonicalDomainId) } : {}) }] : (await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", domain.schoolId).eq("surface", "public").eq("status", "active")).take(20)).map((item) => ({ id: String(item._id), hostname: item.hostname, status: item.status, canonicalIntent: item.canonicalIntent, ...(item.canonicalDomainId ? { canonicalDomainId: String(item.canonicalDomainId) } : {}) }));
  const content = fieldProjection(revision.content);
  return { profile: { schoolId: String(domain.schoolId), schoolSlug: school.slug, mode: profile.mode, status: preview ? profile.status : "published", rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, ...(profile.canonicalDomainId ? { canonicalDomainId: String(profile.canonicalDomainId) } : {}) }, domains, revision: { id: String(revision._id), state: revision.state, rendererKey: revision.rendererKey, rendererSchemaVersion: revision.rendererSchemaVersion, ...(revision.publishedAt ? { publishedAt: revision.publishedAt } : {}), ...content }, assets, links: { application }, ...(preview ? { preview: { authorized: true as const, expiresAt: preview.expiresAt } } : {}) };
}

/** Unauthenticated but intentionally minimal: an active host's immutable published revision only. */
export const getPublishedProjection = query({
  args: { hostname: v.string() },
  handler: async (ctx, args) => {
    const hostname = normalizeHostname(args.hostname); if (!hostname) return null;
    const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique();
    if (!domain || domain.status !== "active") return null;
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique();
    const canonical = profile?.canonicalDomainId ? await ctx.db.get(profile.canonicalDomainId) : null;
    if (!profile || profile.status !== "published" || !canonical || canonical.schoolId !== domain.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical" || !profile.publishedRevisionId) return null;
    return await projectRevision(ctx, domain, profile.publishedRevisionId, null);
  },
});

/** Opaque preview hash lookup. A revoked, expired, cross-host, or stale-revision capability fails closed. */
export const getPreviewProjection = query({
  args: { hostname: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const hostname = normalizeHostname(args.hostname); if (!hostname || !/^[a-f0-9]{64}$/i.test(args.tokenHash)) return null;
    const token = await ctx.db.query("schoolSitePreviewTokens").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash.toLowerCase())).unique();
    if (!token || token.hostname !== hostname || token.expiresAt <= Date.now() || token.revokedAt) return null;
    const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique();
    if (!domain || domain.schoolId !== token.schoolId || ["suspended", "retired"].includes(domain.status)) return null;
    return await projectRevision(ctx, domain, token.revisionId, { expiresAt: token.expiresAt });
  },
});
