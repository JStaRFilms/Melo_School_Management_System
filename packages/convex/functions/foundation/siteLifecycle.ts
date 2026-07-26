import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { siteRevisionContentValidator } from "./contracts";
import { requireSchoolCapabilityV1, resolveSchoolMembershipV1 } from "./auth";

const rendererKeyValidator = v.string();
const hashValidator = v.string();

function requireBoundedContent(content: { fields: readonly { fieldId: string; value: unknown }[]; routeSeo: readonly { routeId: string; title?: string; description?: string; shareAssetId?: unknown }[] }) {
  if (content.fields.length > 300 || content.routeSeo.length > 100) throw new ConvexError("Site content exceeds the publication limit");
  const fieldIds = new Set<string>();
  for (const field of content.fields) {
    if (!/^[a-z0-9._-]{1,120}$/i.test(field.fieldId) || fieldIds.has(field.fieldId)) throw new ConvexError("Invalid or duplicate site field");
    fieldIds.add(field.fieldId);
  }
  const routes = new Set<string>();
  for (const seo of content.routeSeo) {
    if (!/^[a-z0-9._-]{1,120}$/i.test(seo.routeId) || routes.has(seo.routeId)) throw new ConvexError("Invalid or duplicate route metadata");
    if (!seo.title?.trim() || !seo.description?.trim()) throw new ConvexError("Indexable route metadata is required");
    routes.add(seo.routeId);
  }
  return JSON.stringify(content);
}

async function requirePublisher(ctx: Parameters<typeof resolveSchoolMembershipV1>[0], schoolId: Parameters<typeof resolveSchoolMembershipV1>[1], capability: "site.preview" | "site.publish.standard" | "site.revert") {
  const membership = await resolveSchoolMembershipV1(ctx, schoolId);
  if (!membership) throw new ConvexError("Not found or access denied");
  await requireSchoolCapabilityV1(ctx, membership, capability);
  return membership;
}

async function assertApprovedAssets(ctx: Parameters<typeof requirePublisher>[0], schoolId: Parameters<typeof requirePublisher>[1], content: { fields: readonly { value: unknown }[]; routeSeo: readonly { shareAssetId?: unknown }[] }) {
  const assetIds = new Set<string>();
  for (const field of content.fields) {
    const value = field.value as { kind?: string; assetId?: string };
    if (value.kind === "asset_ref" && value.assetId) assetIds.add(value.assetId);
  }
  for (const seo of content.routeSeo) if (seo.shareAssetId) assetIds.add(String(seo.shareAssetId));
  const now = Date.now();
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId as Id<"schoolSiteAssets">);
    if (!asset || asset.schoolId !== schoolId || asset.status !== "published" || asset.rightsStatus !== "approved" || (asset.rightsExpiresAt && asset.rightsExpiresAt <= now) || !asset.purpose || !asset.channels?.length) {
      throw new ConvexError("Referenced site asset is not approved for publication");
    }
  }
}

async function currentRevisionNumber(ctx: Parameters<typeof requirePublisher>[0], schoolId: Parameters<typeof requirePublisher>[1]) {
  const newest = await ctx.db.query("schoolSiteRevisions").withIndex("by_school_and_revision_number", (q) => q.eq("schoolId", schoolId)).order("desc").take(1);
  return (newest[0]?.revisionNumber ?? 0) + 1;
}

export const saveDraft = mutation({
  args: { schoolId: v.id("schools"), expectedDraftVersion: v.number(), content: siteRevisionContentValidator },
  returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const membership = await requirePublisher(ctx, args.schoolId, "site.publish.standard");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!profile?.draftRevisionId) throw new ConvexError("No editable site draft exists");
    const draft = await ctx.db.get(profile.draftRevisionId);
    if (!draft || draft.schoolId !== args.schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== args.expectedDraftVersion) throw new ConvexError("Site draft has changed; reload before saving");
    const contentDigest = requireBoundedContent(args.content);
    await assertApprovedAssets(ctx, args.schoolId, args.content);
    await ctx.db.patch(draft._id, { content: args.content, contentDigest, expectedDraftVersion: draft.expectedDraftVersion + 1, updatedAt: Date.now() });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "draft_saved", revisionId: draft._id, outcome: "success", summary: "Saved bounded site draft", createdAt: Date.now() });
    return draft._id;
  },
});

export const publishDraft = mutation({
  args: { schoolId: v.id("schools"), expectedDraftVersion: v.number() },
  returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const membership = await requirePublisher(ctx, args.schoolId, "site.publish.standard");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!profile?.draftRevisionId || !profile.rendererKey || !profile.rendererSchemaVersion || !profile.canonicalDomainId) throw new ConvexError("Site profile is incomplete");
    const draft = await ctx.db.get(profile.draftRevisionId);
    const canonical = await ctx.db.get(profile.canonicalDomainId);
    if (!draft || draft.schoolId !== args.schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== args.expectedDraftVersion || !canonical || canonical.schoolId !== args.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical") throw new ConvexError("Site draft or canonical domain is not publishable");
    requireBoundedContent(draft.content);
    await assertApprovedAssets(ctx, args.schoolId, draft.content);
    const now = Date.now();
    const publishedId = await ctx.db.insert("schoolSiteRevisions", {
      schoolId: args.schoolId, revisionNumber: await currentRevisionNumber(ctx, args.schoolId), state: "published", rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion,
      content: draft.content, contentDigest: draft.contentDigest, sourceRevisionId: draft._id, approvalEvidenceIds: draft.approvalEvidenceIds, expectedDraftVersion: 0, publishedAt: now, publishedByUserId: membership.userId, createdAt: now, updatedAt: now,
    });
    await ctx.db.patch(profile._id, { status: "published", publishedRevisionId: publishedId, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "published", revisionId: publishedId, outcome: "success", summary: "Published immutable site revision", createdAt: now });
    return publishedId;
  },
});

export const revertPublishedRevision = mutation({
  args: { schoolId: v.id("schools"), revisionId: v.id("schoolSiteRevisions") },
  returns: v.id("schoolSiteRevisions"),
  handler: async (ctx, args) => {
    const membership = await requirePublisher(ctx, args.schoolId, "site.revert");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    const source = await ctx.db.get(args.revisionId);
    if (!profile || !source || source.schoolId !== args.schoolId || source.state !== "published") throw new ConvexError("Published revision not found");
    const now = Date.now();
    const draftId = await ctx.db.insert("schoolSiteRevisions", { schoolId: args.schoolId, revisionNumber: await currentRevisionNumber(ctx, args.schoolId), state: "draft", rendererKey: source.rendererKey, rendererSchemaVersion: source.rendererSchemaVersion, content: source.content, contentDigest: source.contentDigest, sourceRevisionId: source._id, approvalEvidenceIds: source.approvalEvidenceIds, expectedDraftVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.patch(profile._id, { draftRevisionId: draftId, rendererKey: source.rendererKey, rendererSchemaVersion: source.rendererSchemaVersion, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "reverted", revisionId: draftId, outcome: "success", summary: "Created a new draft from immutable publication", createdAt: now });
    return draftId;
  },
});

export const createPreviewToken = mutation({
  args: { schoolId: v.id("schools"), revisionId: v.id("schoolSiteRevisions"), hostname: v.string(), tokenHash: hashValidator, expiresAt: v.number() },
  returns: v.id("schoolSitePreviewTokens"),
  handler: async (ctx, args) => {
    const membership = await requirePublisher(ctx, args.schoolId, "site.preview");
    const revision = await ctx.db.get(args.revisionId);
    if (!revision || revision.schoolId !== args.schoolId || revision.state !== "draft" || !/^[a-z0-9.-]{1,253}$/i.test(args.hostname) || args.expiresAt <= Date.now() || args.expiresAt > Date.now() + 7 * 24 * 60 * 60 * 1000 || !/^[a-f0-9]{64}$/i.test(args.tokenHash)) throw new ConvexError("Invalid preview capability");
    const existing = await ctx.db.query("schoolSitePreviewTokens").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash)).unique();
    if (existing) throw new ConvexError("Preview capability collision");
    const id = await ctx.db.insert("schoolSitePreviewTokens", { schoolId: args.schoolId, revisionId: args.revisionId, hostname: args.hostname.toLowerCase(), tokenHash: args.tokenHash.toLowerCase(), expiresAt: args.expiresAt, createdByUserId: membership.userId, createdAt: Date.now() });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "previewed", revisionId: args.revisionId, outcome: "success", summary: "Issued hostname-bound preview capability", createdAt: Date.now() });
    return id;
  },
});
