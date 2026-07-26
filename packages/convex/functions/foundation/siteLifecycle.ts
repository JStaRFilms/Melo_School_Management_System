import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { siteRevisionContentValidator } from "./contracts";
import { requireSchoolCapabilityV1, resolveSchoolMembershipV1 } from "./auth";
import { assetApprovalClass, assertRendererContent, expectedAssetListUse, expectedAssetUse, getRendererPolicy, requiresSensitivePublication, type RouteSeo, type SiteField } from "./sitePublicationPolicy";

const MAX_PREVIEW_MS = 7 * 24 * 60 * 60 * 1000;
type SiteCapability = "settings.manage" | "site.preview" | "site.publish.standard" | "site.publish.sensitive" | "site.revert";
type SiteCtx = MutationCtx;

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
export async function contentDigest(content: unknown) { return sha256(JSON.stringify(content)); }
export async function publicationManifestDigest(input: { sourceRevisionId: Id<"schoolSiteRevisions">; contentDigest: string; rendererKey: string; rendererSchemaVersion: string; approvalEvidenceIds: readonly Id<"schoolApprovalEvidence">[] }) {
  return sha256(JSON.stringify({ sourceRevisionId: String(input.sourceRevisionId), contentDigest: input.contentDigest, rendererKey: input.rendererKey, rendererSchemaVersion: input.rendererSchemaVersion, approvalEvidenceIds: input.approvalEvidenceIds.map(String) }));
}

function normalizeHostname(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized) ? normalized : null;
}
function secureToken(): string { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return [...bytes].map((part) => part.toString(16).padStart(2, "0")).join(""); }

async function requireCapability(ctx: SiteCtx, schoolId: Id<"schools">, capability: SiteCapability) {
  const membership = await resolveSchoolMembershipV1(ctx, schoolId);
  if (!membership) throw new ConvexError("Not found or access denied");
  await requireSchoolCapabilityV1(ctx, membership, capability);
  return membership;
}
async function requirePublishCapabilities(ctx: SiteCtx, schoolId: Id<"schools">, content: { fields: readonly SiteField[]; routeSeo: readonly RouteSeo[] }) {
  const membership = await requireCapability(ctx, schoolId, "site.publish.standard");
  if (requiresSensitivePublication(content)) await requireSchoolCapabilityV1(ctx, membership, "site.publish.sensitive");
  return membership;
}

async function exactEvidence(ctx: SiteCtx, schoolId: Id<"schools">, evidenceIds: readonly Id<"schoolApprovalEvidence">[], subjectType: string, subjectKey: string, approvalClass: "standard" | "sensitive_public" | "identity" | "privacy", digest: string) {
  const now = Date.now();
  for (const id of evidenceIds) {
    const evidence = await ctx.db.get(id);
    const approver = evidence?.approvedByUserId ? await ctx.db.get(evidence.approvedByUserId) : null;
    if (evidence?.schoolId === schoolId && evidence.subjectType === subjectType && evidence.subjectKey === subjectKey && evidence.approvalClass === approvalClass && evidence.approvedValueDigest === digest && evidence.approvalProvenance === "accountable_school_approver" && approver?.schoolId === schoolId && !evidence.revokedAt && evidence.approvedAt <= now && (!evidence.expiresAt || evidence.expiresAt > now)) return;
  }
  throw new ConvexError("Current accountable exact approval evidence is required for publication");
}

export async function assetApprovalDigest(asset: { _id: Id<"schoolSiteAssets">; checksum: string; kind: string; purpose?: string; channels?: readonly string[]; decorative: boolean; altText?: string; caption?: string; credit?: string; rightsSubject?: string; consentScope?: string; consentExpiresAt?: number; rightsExpiresAt?: number }) {
  return sha256(JSON.stringify({ id: String(asset._id), checksum: asset.checksum, kind: asset.kind, purpose: asset.purpose, channels: asset.channels ?? [], decorative: asset.decorative, altText: asset.altText ?? null, caption: asset.caption ?? null, credit: asset.credit ?? null, rightsSubject: asset.rightsSubject ?? null, consentScope: asset.consentScope ?? null, consentExpiresAt: asset.consentExpiresAt ?? null, rightsExpiresAt: asset.rightsExpiresAt ?? null }));
}

export async function assertApprovedAsset(ctx: SiteCtx, schoolId: Id<"schools">, evidenceIds: readonly Id<"schoolApprovalEvidence">[], assetId: Id<"schoolSiteAssets">, use: { kinds: readonly string[]; purposes: readonly string[]; channel: "site" | "social_share" }) {
  const asset = await ctx.db.get(assetId); const now = Date.now();
  if (!asset || asset.schoolId !== schoolId || asset.status !== "published" || asset.rightsStatus !== "approved" || !asset.approvalEvidenceId || !asset.rightsSubject || asset.consentScope !== "public_site" || (asset.rightsExpiresAt !== undefined && asset.rightsExpiresAt <= now) || (asset.consentExpiresAt !== undefined && asset.consentExpiresAt <= now) || !use.kinds.includes(asset.kind) || !asset.purpose || !use.purposes.includes(asset.purpose) || !asset.channels?.includes(use.channel) || (asset.decorative ? asset.altText !== undefined : !asset.altText?.trim()) || (asset.caption !== undefined && (!asset.caption.trim() || asset.caption.length > 600)) || (asset.credit !== undefined && (!asset.credit.trim() || asset.credit.length > 300))) throw new ConvexError("Referenced site asset is not approved for this field use");
  const digest = await assetApprovalDigest(asset);
  await exactEvidence(ctx, schoolId, evidenceIds, "site_asset", String(asset._id), assetApprovalClass(asset), digest);
  if (asset.rightsSubject === "child_identifiable_people") await exactEvidence(ctx, schoolId, evidenceIds, "site_asset_rights", String(asset._id), "privacy", digest);
}

export async function assertApprovedPublication(ctx: SiteCtx, schoolId: Id<"schools">, rendererKey: string, rendererSchemaVersion: string, content: { fields: readonly SiteField[]; routeSeo: readonly RouteSeo[] }, evidenceIds: readonly Id<"schoolApprovalEvidence">[]) {
  assertRendererContent(rendererKey, rendererSchemaVersion, content);
  const seenEvidence = new Set(evidenceIds.map(String));
  if (seenEvidence.size !== evidenceIds.length || evidenceIds.length > 400) throw new ConvexError("Invalid publication evidence list");
  for (const field of content.fields) {
    const approvalClass = field.fieldId.startsWith("identity.") || field.fieldId.startsWith("brand.") ? "identity" : field.fieldId.startsWith("contact.") || field.fieldId.startsWith("visit.") || field.fieldId.startsWith("programmes.") || field.fieldId.startsWith("admissions.") || field.fieldId.startsWith("policies.") || field.fieldId === "schoolLife.gallery" ? "sensitive_public" : "standard";
    await exactEvidence(ctx, schoolId, evidenceIds, "site_field", field.fieldId, approvalClass, await sha256(JSON.stringify(field.value)));
    if (field.value.kind === "asset_ref") {
      const use = expectedAssetUse(field.fieldId);
      if (!use || typeof field.value.assetId !== "string") throw new ConvexError("Asset field is not allowed");
      await assertApprovedAsset(ctx, schoolId, evidenceIds, field.value.assetId as Id<"schoolSiteAssets">, use);
    }
    if (field.value.kind === "asset_list") {
      const use = expectedAssetListUse(field.fieldId);
      if (!use || !Array.isArray(field.value.assetIds)) throw new ConvexError("Asset list field is not allowed");
      for (const assetId of field.value.assetIds) await assertApprovedAsset(ctx, schoolId, evidenceIds, assetId as Id<"schoolSiteAssets">, use);
    }
  }
  for (const seo of content.routeSeo) {
    await exactEvidence(ctx, schoolId, evidenceIds, "site_route_seo", seo.routeId, "standard", await sha256(JSON.stringify({ title: seo.title, description: seo.description, shareAssetId: seo.shareAssetId ? String(seo.shareAssetId) : null })));
    if (seo.shareAssetId) await assertApprovedAsset(ctx, schoolId, evidenceIds, seo.shareAssetId as Id<"schoolSiteAssets">, { kinds: ["social_share"], purposes: ["social_share"], channel: "social_share" });
  }
}

async function currentRevisionNumber(ctx: SiteCtx, schoolId: Id<"schools">) { const newest = await ctx.db.query("schoolSiteRevisions").withIndex("by_school_and_revision_number", (q) => q.eq("schoolId", schoolId)).order("desc").take(1); return (newest[0]?.revisionNumber ?? 0) + 1; }
async function revokeRevisionPreviewTokens(ctx: SiteCtx, schoolId: Id<"schools">, revisionId: Id<"schoolSiteRevisions">, now: number) {
  const tokens = await ctx.db.query("schoolSitePreviewTokens").withIndex("by_school_and_revision", (q) => q.eq("schoolId", schoolId).eq("revisionId", revisionId)).take(100);
  for (const token of tokens) if (!token.revokedAt) await ctx.db.patch(token._id, { revokedAt: now });
}

/** Provisioning is explicitly privileged: settings management plus publication authority. */
export const bootstrapManagedSite = mutation({
  args: { schoolId: v.id("schools"), rendererKey: v.string(), rendererSchemaVersion: v.string(), approvalEvidenceIds: v.array(v.id("schoolApprovalEvidence")) }, returns: v.id("schoolSiteProfiles"),
  handler: async (ctx, args) => {
    const membership = await requireCapability(ctx, args.schoolId, "settings.manage"); await requireSchoolCapabilityV1(ctx, membership, "site.publish.standard");
    if (!getRendererPolicy(args.rendererKey, args.rendererSchemaVersion)) throw new ConvexError("Unsupported site renderer or schema version");
    const school = await ctx.db.get(args.schoolId); const existing = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!school || school.status !== "active" || existing) throw new ConvexError("Managed site profile cannot be created");
    const now = Date.now(); const emptyContent = { fields: [], routeSeo: [] }; const draftId = await ctx.db.insert("schoolSiteRevisions", { schoolId: args.schoolId, revisionNumber: 1, state: "draft", rendererKey: args.rendererKey, rendererSchemaVersion: args.rendererSchemaVersion, content: emptyContent, contentDigest: await contentDigest(emptyContent), approvalEvidenceIds: args.approvalEvidenceIds, expectedDraftVersion: 1, createdAt: now, updatedAt: now });
    const profileId = await ctx.db.insert("schoolSiteProfiles", { schoolId: args.schoolId, mode: "managed", status: "draft", rendererKey: args.rendererKey, rendererSchemaVersion: args.rendererSchemaVersion, draftRevisionId: draftId, activePublicDomainCount: 0, createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "draft_saved", revisionId: draftId, outcome: "success", summary: "Created managed site profile and initial draft", createdAt: now }); return profileId;
  },
});

export const saveDraft = mutation({
  args: { schoolId: v.id("schools"), expectedDraftVersion: v.number(), content: siteRevisionContentValidator, approvalEvidenceIds: v.array(v.id("schoolApprovalEvidence")) }, returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const membership = await requireCapability(ctx, args.schoolId, "settings.manage"); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!profile?.draftRevisionId || !profile.rendererKey || !profile.rendererSchemaVersion) throw new ConvexError("No editable site draft exists");
    const draft = await ctx.db.get(profile.draftRevisionId);
    if (!draft || draft.schoolId !== args.schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== args.expectedDraftVersion) throw new ConvexError("Site draft has changed; reload before saving");
    assertRendererContent(profile.rendererKey, profile.rendererSchemaVersion, args.content);
    const now = Date.now(); await ctx.db.patch(draft._id, { content: args.content, contentDigest: await contentDigest(args.content), approvalEvidenceIds: args.approvalEvidenceIds, expectedDraftVersion: draft.expectedDraftVersion + 1, updatedAt: now }); await revokeRevisionPreviewTokens(ctx, args.schoolId, draft._id, now);
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "draft_saved", revisionId: draft._id, outcome: "success", summary: "Saved bounded site draft and invalidated stale previews", createdAt: now }); return draft._id;
  },
});

export const publishDraft = mutation({
  args: { schoolId: v.id("schools"), expectedDraftVersion: v.number() }, returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!school || school.status !== "active" || !profile?.draftRevisionId || !profile.rendererKey || !profile.rendererSchemaVersion || !profile.canonicalDomainId) throw new ConvexError("Site profile is incomplete");
    const draft = await ctx.db.get(profile.draftRevisionId); const canonical = await ctx.db.get(profile.canonicalDomainId);
    if (!draft || draft.schoolId !== args.schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== args.expectedDraftVersion || draft.rendererKey !== profile.rendererKey || draft.rendererSchemaVersion !== profile.rendererSchemaVersion || !canonical || canonical.schoolId !== args.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical") throw new ConvexError("Site draft or canonical domain is not publishable");
    const membership = await requirePublishCapabilities(ctx, args.schoolId, draft.content); await assertApprovedPublication(ctx, args.schoolId, profile.rendererKey, profile.rendererSchemaVersion, draft.content, draft.approvalEvidenceIds);
    const now = Date.now(); const manifest = await publicationManifestDigest({ sourceRevisionId: draft._id, contentDigest: draft.contentDigest, rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, approvalEvidenceIds: draft.approvalEvidenceIds });
    const publishedId = await ctx.db.insert("schoolSiteRevisions", { schoolId: args.schoolId, revisionNumber: await currentRevisionNumber(ctx, args.schoolId), state: "published", rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, content: draft.content, contentDigest: draft.contentDigest, sourceRevisionId: draft._id, approvalEvidenceIds: draft.approvalEvidenceIds, expectedDraftVersion: 0, publishedAt: now, publishedByUserId: membership.userId, publicationManifestDigest: manifest, createdAt: now, updatedAt: now });
    await ctx.db.patch(profile._id, { status: "published", publishedRevisionId: publishedId, updatedAt: now }); await revokeRevisionPreviewTokens(ctx, args.schoolId, draft._id, now);
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "published", revisionId: publishedId, outcome: "success", summary: "Published immutable site revision", createdAt: now }); return publishedId;
  },
});

export const revertPublishedRevision = mutation({
  args: { schoolId: v.id("schools"), revisionId: v.id("schoolSiteRevisions") }, returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const membership = await requireCapability(ctx, args.schoolId, "site.revert"); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique(); const source = await ctx.db.get(args.revisionId);
    if (!profile || !source || source.schoolId !== args.schoolId || source.state !== "published" || !source.publishedAt) throw new ConvexError("Published revision not found");
    const now = Date.now(); if (profile.draftRevisionId) await revokeRevisionPreviewTokens(ctx, args.schoolId, profile.draftRevisionId, now);
    const draftId = await ctx.db.insert("schoolSiteRevisions", { schoolId: args.schoolId, revisionNumber: await currentRevisionNumber(ctx, args.schoolId), state: "draft", rendererKey: source.rendererKey, rendererSchemaVersion: source.rendererSchemaVersion, content: source.content, contentDigest: source.contentDigest, sourceRevisionId: source._id, approvalEvidenceIds: source.approvalEvidenceIds, expectedDraftVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.patch(profile._id, { draftRevisionId: draftId, rendererKey: source.rendererKey, rendererSchemaVersion: source.rendererSchemaVersion, updatedAt: now }); await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "reverted", revisionId: draftId, outcome: "success", summary: "Created a new draft from immutable publication", createdAt: now }); return draftId;
  },
});

export const issuePreviewCapability = mutation({
  args: { schoolId: v.id("schools"), revisionId: v.id("schoolSiteRevisions"), hostname: v.string(), lifetimeMs: v.number() }, returns: v.object({ tokenId: v.id("schoolSitePreviewTokens"), previewToken: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const membership = await requireCapability(ctx, args.schoolId, "site.preview"); const hostname = normalizeHostname(args.hostname); const revision = await ctx.db.get(args.revisionId); const school = await ctx.db.get(args.schoolId); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique(); const domain = hostname ? await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique() : null;
    if (!hostname || !school || school.status !== "active" || !profile || !["draft", "review", "published"].includes(profile.status) || profile.draftRevisionId !== args.revisionId || !revision || revision.schoolId !== args.schoolId || revision.state !== "draft" || !domain || domain.schoolId !== args.schoolId || ["suspended", "retired"].includes(domain.status) || !Number.isInteger(args.lifetimeMs) || args.lifetimeMs <= 0 || args.lifetimeMs > MAX_PREVIEW_MS) throw new ConvexError("Invalid preview capability");
    const previewToken = secureToken(); const tokenHash = await sha256(previewToken); const now = Date.now(); const expiresAt = now + args.lifetimeMs; const profileStatus = profile.status as "draft" | "review" | "published"; const tokenId = await ctx.db.insert("schoolSitePreviewTokens", { schoolId: args.schoolId, revisionId: args.revisionId, draftRevisionId: profile.draftRevisionId, draftVersion: revision.expectedDraftVersion, contentDigest: revision.contentDigest, profileStatus, hostname, tokenHash, expiresAt, createdByUserId: membership.userId, createdAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "previewed", revisionId: args.revisionId, outcome: "success", summary: "Issued draft-version and hostname-bound preview capability", createdAt: now }); return { tokenId, previewToken, expiresAt };
  },
});

export const revokePreviewCapability = mutation({
  args: { schoolId: v.id("schools"), tokenId: v.id("schoolSitePreviewTokens") }, returns: v.null(),
  handler: async (ctx, args) => { const membership = await requireCapability(ctx, args.schoolId, "site.preview"); const token = await ctx.db.get(args.tokenId); if (!token || token.schoolId !== args.schoolId) throw new ConvexError("Preview capability not found"); if (!token.revokedAt) await ctx.db.patch(token._id, { revokedAt: Date.now() }); await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "preview_revoked", revisionId: token.revisionId, outcome: "success", summary: "Revoked hostname-bound preview capability", createdAt: Date.now() }); return null; },
});
