import { v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { assetApprovalClass, assertRendererContent, expectedAssetListUse, expectedAssetUse, fieldApprovalClass, getRendererPolicy } from "./sitePublicationPolicy";
import { assetApprovalDigest, contentDigest, publicationManifestDigest, sha256 } from "./siteLifecycle";

type RevisionContent = { fields: readonly { fieldId: string; value: { kind: string; assetId?: Id<"schoolSiteAssets">; assetIds?: readonly Id<"schoolSiteAssets">[]; value?: unknown } }[]; routeSeo: readonly { routeId: string; title?: string; description?: string; shareAssetId?: Id<"schoolSiteAssets"> }[] };

function normalizeHostname(value: string): string | null { const host = value.trim().toLowerCase().replace(/\.$/, ""); return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) ? host : null; }
function fieldProjection(content: RevisionContent) { return { fields: Object.fromEntries(content.fields.map((field) => [field.fieldId, field.value])), routeSeo: Object.fromEntries(content.routeSeo.map((route) => [route.routeId, { ...(route.title ? { title: route.title } : {}), ...(route.description ? { description: route.description } : {}), ...(route.shareAssetId ? { shareAssetId: String(route.shareAssetId) } : {}) }])) }; }

function assetRefs(content: RevisionContent) {
  const refs: Array<{ assetId: Id<"schoolSiteAssets">; use: { kinds: readonly string[]; purposes: readonly string[]; channel: "site" | "social_share" } }> = [];
  for (const field of content.fields) {
    if (field.value.kind === "asset_ref") { const use = expectedAssetUse(field.fieldId); if (!use || !field.value.assetId) return null; refs.push({ assetId: field.value.assetId, use }); }
    if (field.value.kind === "asset_list") { const use = expectedAssetListUse(field.fieldId); if (!use || !field.value.assetIds) return null; for (const assetId of field.value.assetIds) refs.push({ assetId, use }); }
  }
  for (const seo of content.routeSeo) if (seo.shareAssetId) refs.push({ assetId: seo.shareAssetId, use: { kinds: ["social_share"], purposes: ["social_share"], channel: "social_share" } });
  return refs;
}

async function evidenceIsCurrent(ctx: QueryCtx, schoolId: Id<"schools">, evidenceId: Id<"schoolApprovalEvidence"> | undefined) {
  if (!evidenceId) return false;
  const evidence = await ctx.db.get(evidenceId); const approver = evidence?.approvedByUserId ? await ctx.db.get(evidence.approvedByUserId) : null; const now = Date.now();
  return Boolean(evidence && evidence.schoolId === schoolId && evidence.approvalProvenance === "accountable_school_approver" && approver?.schoolId === schoolId && evidence.approvedAt <= now && !evidence.revokedAt && (!evidence.expiresAt || evidence.expiresAt > now));
}
async function exactEvidence(ctx: QueryCtx, schoolId: Id<"schools">, evidenceIds: readonly Id<"schoolApprovalEvidence">[], subjectType: string, subjectKey: string, approvalClass: "standard" | "sensitive_public" | "identity" | "privacy", digest: string) {
  for (const evidenceId of evidenceIds) { const evidence = await ctx.db.get(evidenceId); if (evidence?.subjectType === subjectType && evidence.subjectKey === subjectKey && evidence.approvalClass === approvalClass && evidence.approvedValueDigest === digest && await evidenceIsCurrent(ctx, schoolId, evidenceId)) return true; }
  return false;
}
function assetMatches(asset: { kind: string; purpose?: string; channels?: readonly string[] }, use: { kinds: readonly string[]; purposes: readonly string[]; channel: "site" | "social_share" }) { return use.kinds.includes(asset.kind) && Boolean(asset.purpose && use.purposes.includes(asset.purpose) && asset.channels?.includes(use.channel)); }

/** Rechecks the entire immutable manifest. Public reads never trust an inserted row merely because it says published. */
async function currentRevisionIsSafe(ctx: QueryCtx, schoolId: Id<"schools">, revision: { _id: Id<"schoolSiteRevisions">; state: string; rendererKey: string; rendererSchemaVersion: string; content: RevisionContent; contentDigest: string; sourceRevisionId?: Id<"schoolSiteRevisions">; publicationManifestDigest?: string; approvalEvidenceIds: readonly Id<"schoolApprovalEvidence">[]; publishedByUserId?: Id<"users">; publishedAt?: number }) {
  if ((revision.state !== "published" && revision.state !== "draft") || !getRendererPolicy(revision.rendererKey, revision.rendererSchemaVersion)) return false;
  try { assertRendererContent(revision.rendererKey, revision.rendererSchemaVersion, revision.content); } catch { return false; }
  if (revision.contentDigest !== await contentDigest(revision.content)) return false;
  if (revision.state === "published") {
    if (!revision.publishedAt || !revision.sourceRevisionId || !revision.publicationManifestDigest || !revision.publishedByUserId) return false;
    const source = await ctx.db.get(revision.sourceRevisionId); const publisher = await ctx.db.get(revision.publishedByUserId);
    if (!source || source.schoolId !== schoolId || source.state !== "draft" || !publisher || publisher.schoolId !== schoolId || revision.publicationManifestDigest !== await publicationManifestDigest({ sourceRevisionId: revision.sourceRevisionId, contentDigest: revision.contentDigest, rendererKey: revision.rendererKey, rendererSchemaVersion: revision.rendererSchemaVersion, approvalEvidenceIds: revision.approvalEvidenceIds })) return false;
  }
  if (new Set(revision.approvalEvidenceIds.map(String)).size !== revision.approvalEvidenceIds.length || revision.approvalEvidenceIds.length > 400) return false;
  for (const evidenceId of revision.approvalEvidenceIds) if (!await evidenceIsCurrent(ctx, schoolId, evidenceId)) return false;
  for (const field of revision.content.fields) {
    const approvalClass = fieldApprovalClass(field.fieldId); if (!approvalClass || !await exactEvidence(ctx, schoolId, revision.approvalEvidenceIds, "site_field", field.fieldId, approvalClass, await sha256(JSON.stringify(field.value)))) return false;
  }
  for (const seo of revision.content.routeSeo) if (!await exactEvidence(ctx, schoolId, revision.approvalEvidenceIds, "site_route_seo", seo.routeId, "standard", await sha256(JSON.stringify({ title: seo.title, description: seo.description, shareAssetId: seo.shareAssetId ? String(seo.shareAssetId) : null })))) return false;
  const refs = assetRefs(revision.content); if (!refs) return false;
  for (const { assetId, use } of refs) {
    const asset = await ctx.db.get(assetId); const now = Date.now();
    if (!asset || asset.schoolId !== schoolId || asset.status !== "published" || asset.rightsStatus !== "approved" || !asset.approvalEvidenceId || !asset.rightsSubject || asset.consentScope !== "public_site" || (asset.rightsExpiresAt !== undefined && asset.rightsExpiresAt <= now) || (asset.consentExpiresAt !== undefined && asset.consentExpiresAt <= now) || !assetMatches(asset, use) || (asset.decorative ? asset.altText !== undefined : !asset.altText?.trim()) || (asset.caption !== undefined && (!asset.caption.trim() || asset.caption.length > 600)) || (asset.credit !== undefined && (!asset.credit.trim() || asset.credit.length > 300))) return false;
    const digest = await assetApprovalDigest(asset);
    if (!await exactEvidence(ctx, schoolId, revision.approvalEvidenceIds, "site_asset", String(asset._id), assetApprovalClass(asset), digest)) return false;
    if (asset.rightsSubject === "child_identifiable_people" && !await exactEvidence(ctx, schoolId, revision.approvalEvidenceIds, "site_asset_rights", String(asset._id), "privacy", digest)) return false;
  }
  return true;
}

async function approvedAssetProjection(ctx: QueryCtx, schoolId: Id<"schools">, revision: { content: RevisionContent }) {
  const refs = assetRefs(revision.content); if (!refs) return null;
  const assets: Array<{ id: string; [key: string]: unknown }> = [];
  for (const { assetId } of refs) {
    if (assets.some((asset) => asset.id === String(assetId))) continue;
    const asset = await ctx.db.get(assetId); if (!asset) return null; const url = await ctx.storage.getUrl(asset.storageId); if (!url) return null;
    assets.push({ id: String(asset._id), url, kind: asset.kind, purpose: asset.purpose!, channels: asset.channels!, decorative: asset.decorative, ...(asset.altText ? { altText: asset.altText } : {}), ...(asset.caption ? { caption: asset.caption } : {}), ...(asset.credit ? { credit: asset.credit } : {}), ...(asset.width ? { width: asset.width } : {}), ...(asset.height ? { height: asset.height } : {}), rightsStatus: "approved" as const, status: "published" as const, ...(asset.rightsExpiresAt ? { rightsExpiresAt: asset.rightsExpiresAt } : {}) });
  }
  return assets;
}

async function projectRevision(ctx: QueryCtx, domain: { _id: Id<"schoolDomains">; schoolId: Id<"schools">; hostname: string; status: string; canonicalIntent: string; canonicalDomainId?: Id<"schoolDomains"> }, revisionId: Id<"schoolSiteRevisions">, preview: { expiresAt: number } | null) {
  const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique(); const school = await ctx.db.get(domain.schoolId); const revision = await ctx.db.get(revisionId);
  if (!profile || !school || school.status !== "active" || !revision || revision.schoolId !== domain.schoolId || profile.mode !== "managed" || !profile.rendererKey || !profile.rendererSchemaVersion || revision.rendererKey !== profile.rendererKey || revision.rendererSchemaVersion !== profile.rendererSchemaVersion || !(await currentRevisionIsSafe(ctx, domain.schoolId, revision))) return null;
  if (preview ? revision.state !== "draft" : revision.state !== "published" || !revision.publishedAt) return null;
  const assets = await approvedAssetProjection(ctx, domain.schoolId, revision); if (!assets) return null;
  const application: { version: "1"; schoolSlug: string; href: string; availability: "open" | "upcoming" | "paused" | "closed" | "unavailable"; intakeSlug: string | null; opensAt: number | null; closesAt: number | null } = await ctx.runQuery(api.functions.foundation.applicationLinks.getApplicationLink, { schoolSlug: school.slug });
  const domains = preview ? [{ id: String(domain._id), hostname: domain.hostname, status: domain.status, canonicalIntent: domain.canonicalIntent, ...(domain.canonicalDomainId ? { canonicalDomainId: String(domain.canonicalDomainId) } : {}) }] : (await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", domain.schoolId).eq("surface", "public").eq("status", "active")).take(20)).map((item) => ({ id: String(item._id), hostname: item.hostname, status: item.status, canonicalIntent: item.canonicalIntent, ...(item.canonicalDomainId ? { canonicalDomainId: String(item.canonicalDomainId) } : {}) }));
  return { profile: { schoolId: String(domain.schoolId), schoolSlug: school.slug, mode: profile.mode, status: preview ? profile.status : "published", rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, ...(profile.canonicalDomainId ? { canonicalDomainId: String(profile.canonicalDomainId) } : {}) }, domains, revision: { id: String(revision._id), state: revision.state, rendererKey: revision.rendererKey, rendererSchemaVersion: revision.rendererSchemaVersion, ...(revision.publishedAt ? { publishedAt: revision.publishedAt } : {}), ...fieldProjection(revision.content) }, assets, links: { application }, ...(preview ? { preview: { authorized: true as const, expiresAt: preview.expiresAt } } : {}) };
}

export const getPublishedProjection = query({ args: { hostname: v.string() }, handler: async (ctx, args) => { const hostname = normalizeHostname(args.hostname); if (!hostname) return null; const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique(); if (!domain || domain.status !== "active") return null; const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique(); const canonical = profile?.canonicalDomainId ? await ctx.db.get(profile.canonicalDomainId) : null; if (!profile || profile.status !== "published" || !canonical || canonical.schoolId !== domain.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical" || !profile.publishedRevisionId) return null; return projectRevision(ctx, domain, profile.publishedRevisionId, null); } });

export const getPreviewProjection = query({ args: { hostname: v.string(), tokenHash: v.string() }, handler: async (ctx, args) => { const hostname = normalizeHostname(args.hostname); if (!hostname || !/^[a-f0-9]{64}$/i.test(args.tokenHash)) return null; const token = await ctx.db.query("schoolSitePreviewTokens").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash.toLowerCase())).unique(); if (!token || token.hostname !== hostname || token.expiresAt <= Date.now() || token.revokedAt || !token.draftRevisionId || token.draftVersion === undefined || !token.contentDigest || !token.profileStatus) return null; const domain = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique(); const profile = domain ? await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique() : null; const revision = await ctx.db.get(token.revisionId); if (!domain || !profile || domain.schoolId !== token.schoolId || ["suspended", "retired"].includes(domain.status) || profile.draftRevisionId !== token.draftRevisionId || profile.draftRevisionId !== token.revisionId || profile.status !== token.profileStatus || !revision || revision.state !== "draft" || revision.expectedDraftVersion !== token.draftVersion || revision.contentDigest !== token.contentDigest) return null; return projectRevision(ctx, domain, token.revisionId, { expiresAt: token.expiresAt }); } });
