import { v } from "convex/values";
import { mutation, action, internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { siteRevisionContentValidator } from "../foundation/contracts";
import { checkedContent, deny, ownedProfile, schoolActor, sha256, contentCanonical, validatePublication } from "./shared";
import type { Id } from "../../_generated/dataModel";
import type { PreviewSiteV1 } from "@school/shared/site-manifests";

export const saveDraft = mutation({
  args: { schoolId: v.id("schools"), content: siteRevisionContentValidator, expectedDraftVersion: v.number() },
  handler: async (ctx, {schoolId, content, expectedDraftVersion}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "settings.manage", now);
    const profile = await ownedProfile(ctx, schoolId);
    checkedContent(profile, content);
    if (!Number.isSafeInteger(expectedDraftVersion) || expectedDraftVersion < 0) return deny();
    const previous = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (previous && (previous.schoolId !== schoolId || previous.state !== "draft")) return deny();
    if ((previous?.expectedDraftVersion ?? 0) !== expectedDraftVersion) throw Error("DRAFT_VERSION_CONFLICT");
    const digest = await sha256(contentCanonical(content));
    let draftId: Id<"schoolSiteRevisions">;
    if (previous) {
      await ctx.db.patch(previous._id, {content, contentDigest: digest, expectedDraftVersion: expectedDraftVersion + 1, updatedAt: now});
      draftId = previous._id;
    } else {
      draftId = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: 0, state: "draft", rendererKey: profile.rendererKey!, rendererSchemaVersion: profile.rendererSchemaVersion!, content, contentDigest: digest, approvalEvidenceIds: [], expectedDraftVersion: 1, createdAt: now, updatedAt: now });
      await ctx.db.patch(profile._id, {draftRevisionId: draftId, updatedAt: now});
    }
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "draft_saved", outcome: "success", summary: `Draft version ${expectedDraftVersion + 1}`, revisionId: draftId, createdAt: now});
    return { draftId, draftVersion: expectedDraftVersion + 1 };
  },
});

export const validateDraft = action({
  args: {schoolId: v.id("schools")},
  handler: async (ctx, {schoolId}): Promise<{valid: boolean; draftVersion: number}> => ctx.runQuery(internal.functions.sites.reads.validateDraftAtTime, {schoolId, now: Date.now()}),
});
export const recordPreview = internalMutation({
  args: {schoolId: v.id("schools"), draftVersion: v.number()},
  handler: async (ctx, {schoolId,draftVersion}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "site.preview", now);
    const profile = await ownedProfile(ctx, schoolId);
    const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (!draft || draft.schoolId !== schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== draftVersion) return deny();
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "previewed", outcome: "success", summary: `Previewed draft version ${draftVersion}`, revisionId: draft._id, createdAt: now});
    return null;
  },
});
export const previewDraft = action({
  args: {schoolId: v.id("schools")},
  handler: async (ctx, {schoolId}): Promise<PreviewSiteV1> => {
    const preview: PreviewSiteV1 & {draftVersion: number} = await ctx.runQuery(internal.functions.sites.reads.previewAtTime, {schoolId, now: Date.now()});
    await ctx.runMutation(internal.functions.sites.content.recordPreview, {schoolId, draftVersion: preview.draftVersion});
    const { draftVersion: _draftVersion, ...safePreview } = preview;
    return safePreview;
  },
});

export const publishDraft = mutation({
  args: {schoolId: v.id("schools"), expectedDraftVersion: v.number()},
  handler: async (ctx, {schoolId, expectedDraftVersion}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "site.publish.standard", now);
    const profile = await ownedProfile(ctx, schoolId);
    if (profile.status === "suspended" || profile.status === "retired") return deny();
    const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (!draft || draft.schoolId !== schoolId || draft.state !== "draft" || draft.expectedDraftVersion !== expectedDraftVersion || draft.rendererKey !== profile.rendererKey || draft.rendererSchemaVersion !== profile.rendererSchemaVersion) return deny();
    const checked = await validatePublication(ctx, profile, draft.content, actor, now);
    if (checked.sensitive) await schoolActor(ctx, schoolId, "site.publish.sensitive", now);
    const referencedAssets = new Set([
      ...draft.content.fields.flatMap(field => field.value.kind === "asset_ref" ? [field.value.assetId] : []),
      ...draft.content.routeSeo.flatMap(seo => seo.shareAssetId ? [seo.shareAssetId] : []),
    ]);
    for (const assetId of referencedAssets) await ctx.db.patch(assetId, {status: "published", updatedAt: now});
    const last = await ctx.db.query("schoolSiteRevisions").withIndex("by_school_and_revision_number", q => q.eq("schoolId", schoolId)).order("desc").take(1);
    const publishedId = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: (last[0]?.revisionNumber ?? 0) + 1, state: "published", rendererKey: draft.rendererKey, rendererSchemaVersion: draft.rendererSchemaVersion, content: draft.content, contentDigest: checked.digest, sourceRevisionId: draft._id, approvalEvidenceIds: checked.evidenceIds, expectedDraftVersion: draft.expectedDraftVersion, publishedAt: now, publishedByUserId: actor, createdAt: now, updatedAt: now });
    await ctx.db.patch(profile._id, {publishedRevisionId: publishedId, status: "published", updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "published", outcome: "success", summary: "Published validated site revision", revisionId: publishedId, createdAt: now});
    return {publishedId};
  },
});

export const revertToDraft = mutation({
  args: {schoolId: v.id("schools"), sourceRevisionId: v.id("schoolSiteRevisions")},
  handler: async (ctx, {schoolId, sourceRevisionId}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "site.revert", now);
    const profile = await ownedProfile(ctx, schoolId);
    const source = await ctx.db.get(sourceRevisionId);
    if (!source || source.schoolId !== schoolId || source.state !== "published" || source.rendererKey !== profile.rendererKey || source.rendererSchemaVersion !== profile.rendererSchemaVersion) return deny();
    checkedContent(profile, source.content);
    const id = await ctx.db.insert("schoolSiteRevisions", { schoolId, revisionNumber: 0, state: "draft", rendererKey: source.rendererKey, rendererSchemaVersion: source.rendererSchemaVersion, content: source.content, contentDigest: source.contentDigest, sourceRevisionId, approvalEvidenceIds: [], expectedDraftVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.patch(profile._id, {draftRevisionId: id, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "reverted", outcome: "success", summary: "Cloned publication to private draft", revisionId: id, createdAt: now});
    return {draftId: id, draftVersion: 1};
  },
});
