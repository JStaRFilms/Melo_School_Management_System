import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";

type Context = QueryCtx | MutationCtx;
async function owned(ctx: Context, schoolId: Id<"schools">, assetId: Id<"schoolAssets">) {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.schoolId !== schoolId) throw new ConvexError("Asset not found in this branch");
  return asset;
}
// Never return storage IDs or URL-bearing payloads to library/inspection clients.
export function assetMetadata(a: Doc<"schoolAssets">) {
  return { _id: a._id, schoolId: a.schoolId, fileName: a.fileName, category: a.category,
    description: a.description ?? "", mimeType: a.mimeType, byteSize: a.byteSize, sha256: a.sha256,
    uploadedByUserId: a.uploadedByUserId ?? null, createdAt: a.createdAt, updatedAt: a.updatedAt,
    validationStatus: a.validationStatus ?? "pending", scanStatus: a.scanStatus, scanFailureCode: a.scanFailureCode ?? null,
    archivedAt: a.archivedAt ?? null, isTrashed: a.isTrashed, trashedAt: a.trashedAt ?? null,
    trashedByUserId: a.trashedByUserId ?? null, purgeScheduledAt: a.purgeScheduledAt ?? null,
    accountingReady: a.storageAccountingInitializedAt !== undefined && !a.storageReconciliationState,
    isOptimized: a.isOptimized ?? false, rollbackExpiryAt: a.rollbackExpiryAt ?? null,
    hasRollbackOriginal: !!a.rollbackStorageId };
}

/** Deliberately shared metadata: no uploader, hash, lifecycle, storage, or accounting authority. */
function sharedAssetMetadata(a: Doc<"schoolAssets">) {
  return {
    _id: a._id,
    fileName: a.fileName,
    category: a.category,
    description: a.description ?? "",
    mimeType: a.mimeType,
    byteSize: a.byteSize,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    validationStatus: a.validationStatus ?? "pending",
    scanStatus: a.scanStatus,
  };
}
export const getWorkspace = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const actor = await requireCapability(ctx, schoolId, "assets.library.view");
    const [policy, meter] = await Promise.all([
      ctx.db.query("assetPolicies").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique(),
      ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique(),
    ]);
    return { capabilities: actor.effectiveCapabilities, maxFileSizeBytes: policy?.maxFileSizeBytes ?? 25 * 1024 * 1024,
      policyReference: policy?.policyReference ?? null, trashRetentionDays: policy?.trashRetentionDays ?? 30,
      // Generic storage URLs cannot reserve quota or prove/clean up ownership.
      uploadAvailable: false, downloadAvailable: false, optimizationAvailable: false,
      storage: meter ? { active: meter.activeStorageBytes ?? null, trash: meter.trashStorageBytes ?? null,
        temp: meter.tempStorageBytes ?? null, consumed: meter.consumedUnits, reserved: meter.reservedUnits,
        allocated: meter.allocatedUnits, available: Math.max(0, meter.allocatedUnits - meter.consumedUnits - meter.reservedUnits) } : null };
  },
});
export const listAssets = query({
  args: { schoolId: v.id("schools"), workspace: v.union(v.literal("library"), v.literal("archive"), v.literal("trash")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.library.view");
    if (args.workspace === "trash") await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    if (args.workspace === "archive") await requireCapability(ctx, args.schoolId, "assets.archive.manage");
    const page = args.workspace === "trash"
      ? await ctx.db
          .query("schoolAssets")
          .withIndex("by_school_and_trashed", q => q.eq("schoolId", args.schoolId).eq("isTrashed", true))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("schoolAssets")
          .withIndex("by_school_and_trashed_and_archived_at", q => {
            const branchAssets = q.eq("schoolId", args.schoolId).eq("isTrashed", false);
            return args.workspace === "archive"
              ? branchAssets.gt("archivedAt", 0)
              : branchAssets.eq("archivedAt", undefined);
          })
          .order("desc")
          .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(assetMetadata) };
  },
});
export const inspectAsset = query({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.library.view");
    const asset = await owned(ctx, args.schoolId, args.assetId);
    if (asset.isTrashed) await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    else if (asset.archivedAt !== undefined) await requireCapability(ctx, args.schoolId, "assets.archive.manage");
    const [holds, shares, candidates, owner] = await Promise.all([
      ctx.db.query("assetRetentionHolds").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(51),
      ctx.db.query("assetBranchShares").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(51),
      ctx.db.query("pdfCompressionCandidates").withIndex("by_asset_and_source_and_candidate", q => q.eq("assetId", asset._id)).order("desc").take(10),
      asset.uploadedByUserId ? ctx.db.get(asset.uploadedByUserId) : null,
    ]);
    return { ...assetMetadata(asset), ownerName: owner?.name ?? "Owner not recorded", holds: holds.map(h => ({ _id: h._id, reason: h.holdReason, appliedAt: h.appliedAt })),
      holdsTruncated: holds.length > 50, shares: shares.map(s => ({ _id: s._id, schoolId: s.recipientSchoolId })),
      candidates: candidates.map(c => ({ _id: c._id, status: c.status, reason: c.reason ?? null, verifiedAt: c.verifiedAt, cleanupScheduledAt: c.cleanupScheduledAt ?? null })),
      pdfEligibility: asset.mimeType !== "application/pdf" ? "skip: not a PDF" : asset.isTrashed || asset.scanStatus !== "clean" || asset.validationStatus !== "valid" ? "unavailable: requires active signature-validated scanner evidence" : "unavailable: runtime and fidelity approval; eligibility not established" };
  },
});
export const editMetadata = mutation({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), fileName: v.string(), category: v.string(), description: v.string(), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.metadata.edit");
    const asset = await owned(ctx, args.schoolId, args.assetId);
    if (asset.isTrashed || asset.updatedAt !== args.expectedUpdatedAt) throw new ConvexError("Asset changed or is in Trash; inspect again before editing");
    if (!args.fileName.trim() || args.fileName.length > 200 || args.category.length > 80 || args.description.length > 1000) throw new ConvexError("Name required; limits: name 200, category 80, description 1000 characters");
    await ctx.db.patch(asset._id, { fileName: args.fileName.trim(), category: args.category.trim(), description: args.description.trim(), updatedAt: Math.max(Date.now(), asset.updatedAt + 1) });
    await recordAuditEventHelper(ctx, { schoolId: args.schoolId, actorKind: actor.isPlatformAdmin ? "platform_admin" : "user", actorPersonId: actor.personId, actorMembershipId: actor.membershipId, actorEmailSnapshot: "authenticated asset operator", module: "assets", action: "asset.metadata_edited", targetType: "schoolAsset", targetId: asset._id, outcome: "success", safeSummary: "Asset descriptive metadata updated; file bytes unchanged." });
  },
});
export const setArchived = mutation({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.archive.manage");
    const asset = await owned(ctx, args.schoolId, args.assetId);
    if (asset.isTrashed) throw new ConvexError("Restore from Trash before changing archive status");
    if ((asset.archivedAt !== undefined) === args.archived) return;
    await ctx.db.patch(asset._id, { archivedAt: args.archived ? Date.now() : undefined, archivedByUserId: args.archived ? actor.userId : undefined, updatedAt: Date.now() });
    await recordAuditEventHelper(ctx, { schoolId: args.schoolId, actorKind: actor.isPlatformAdmin ? "platform_admin" : "user", actorPersonId: actor.personId, actorMembershipId: actor.membershipId, actorEmailSnapshot: "authenticated asset operator", module: "assets", action: args.archived ? "asset.archived" : "asset.unarchived", targetType: "schoolAsset", targetId: asset._id, outcome: "success", safeSummary: "Archive status changed; ownership, sharing and charged active bytes unchanged." });
  },
});
export const listShareRecipients = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.group_share.manage");
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    if (!link) return [];
    const group = await ctx.db.get(link.groupId);
    if (group?.status !== "active") return [];
    const links = await ctx.db.query("schoolGroupBranches").withIndex("by_group", q => q.eq("groupId", link.groupId)).take(101);
    if (links.length > 100) throw new ConvexError("Group exceeds supported recipient directory");
    const recipients = [];
    for (const other of links) {
      if (other.schoolId === args.schoolId) continue;
      const school = await ctx.db.get(other.schoolId);
      if (school?.status === "active") recipients.push({ schoolId: school._id, name: school.name });
    }
    return recipients;
  },
});
export const setBranchShare = mutation({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), recipientSchoolId: v.id("schools"), shared: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.group_share.manage");
    const asset = await owned(ctx, args.schoolId, args.assetId);
    const existing = await ctx.db.query("assetBranchShares").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(51);
    const share = existing.find(s => s.recipientSchoolId === args.recipientSchoolId);
    if (args.shared) {
      if (asset.isTrashed || args.schoolId === args.recipientSchoolId || existing.length >= 50) throw new ConvexError("Invalid share target, trashed asset or share limit reached");
      const [owner, recipient, school] = await Promise.all([
        ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique(),
        ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.recipientSchoolId)).unique(),
        ctx.db.get(args.recipientSchoolId),
      ]);
      if (!owner || !recipient || owner.groupId !== recipient.groupId || school?.status !== "active" || (await ctx.db.get(owner.groupId))?.status !== "active") throw new ConvexError("Recipient must be an authorized active branch in the same active group");
      if (share) return;
      await ctx.db.insert("assetBranchShares", { assetId: asset._id, ownerSchoolId: args.schoolId, recipientSchoolId: args.recipientSchoolId, createdAt: Date.now() });
    } else {
      if (!share) return;
      await ctx.db.delete(share._id);
    }
    await recordAuditEventHelper(ctx, { schoolId: args.schoolId, actorKind: actor.isPlatformAdmin ? "platform_admin" : "user", actorPersonId: actor.personId, actorMembershipId: actor.membershipId, actorEmailSnapshot: "authenticated asset operator", module: "assets", action: args.shared ? "asset.share_granted" : "asset.share_revoked", targetType: "schoolAsset", targetId: asset._id, outcome: "success", safeSummary: "Explicit branch metadata share changed; download remains unavailable." });
  },
});
export const listSharedAssets = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.library.view");
    const recipient = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    if (!recipient || (await ctx.db.get(recipient.groupId))?.status !== "active") return { rows: [], truncated: false };
    const grants = await ctx.db.query("assetBranchShares").withIndex("by_recipient", q => q.eq("recipientSchoolId", args.schoolId)).take(51);
    const rows = [];
    for (const grant of grants.slice(0, 50)) {
      const [asset, owner, school] = await Promise.all([
        ctx.db.get(grant.assetId),
        ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", grant.ownerSchoolId)).unique(),
        ctx.db.get(grant.ownerSchoolId),
      ]);
      if (asset && asset.schoolId === grant.ownerSchoolId && !asset.isTrashed && asset.archivedAt === undefined && owner?.groupId === recipient.groupId && school?.status === "active") rows.push({ ...sharedAssetMetadata(asset), ownerSchoolName: school.name });
    }
    return { rows, truncated: grants.length > 50 };
  },
});

export const configurePolicy = internalMutation({
  args: { schoolId: v.id("schools"), maxFileSizeBytes: v.number(), trashRetentionDays: v.number(), policyReference: v.string() },
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.maxFileSizeBytes) || args.maxFileSizeBytes < 1 || args.maxFileSizeBytes > 100 * 1024 * 1024 || !Number.isSafeInteger(args.trashRetentionDays) || args.trashRetentionDays < 1 || args.trashRetentionDays > 3650 || !args.policyReference.trim() || args.policyReference.length > 200 || !await ctx.db.get(args.schoolId)) throw new ConvexError("Invalid approved asset policy");
    const prior = await ctx.db.query("assetPolicies").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    if (prior) await ctx.db.patch(prior._id, { ...args, updatedAt: Date.now() });
    else await ctx.db.insert("assetPolicies", { ...args, updatedAt: Date.now() });
  },
});
