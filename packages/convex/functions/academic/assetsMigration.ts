import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type StorageReconciliationIssueCode = "missing_storage" | "duplicate_storage_ownership";

async function recordStorageReconciliationIssue(
  ctx: MutationCtx,
  asset: Doc<"schoolAssets">,
  storageId: Id<"_storage">,
  code: StorageReconciliationIssueCode,
  now: number,
): Promise<void> {
  const existing = await ctx.db
    .query("assetStorageReconciliationIssues")
    .withIndex("by_asset_and_storage_and_code", (q) =>
      q.eq("assetId", asset._id).eq("storageId", storageId).eq("code", code)
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "open",
      resolvedAt: undefined,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("assetStorageReconciliationIssues", {
    schoolId: asset.schoolId,
    assetId: asset._id,
    storageId,
    code,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

async function resolveStorageReconciliationIssues(
  ctx: MutationCtx,
  asset: Doc<"schoolAssets">,
  storageIds: Id<"_storage">[],
  now: number,
): Promise<void> {
  for (const storageId of storageIds) {
    for (const code of ["missing_storage", "duplicate_storage_ownership"] as const) {
      const issue = await ctx.db
        .query("assetStorageReconciliationIssues")
        .withIndex("by_asset_and_storage_and_code", (q) =>
          q.eq("assetId", asset._id).eq("storageId", storageId).eq("code", code)
        )
        .unique();
      if (issue?.status === "open") {
        await ctx.db.patch(issue._id, { status: "resolved", resolvedAt: now, updatedAt: now });
      }
    }
  }
}

async function ownersOfStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<Doc<"schoolAssets">[]> {
  const owners = new Map<string, Doc<"schoolAssets">>();
  for await (const asset of ctx.db
    .query("schoolAssets")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))) {
    owners.set(String(asset._id), asset);
  }
  for await (const asset of ctx.db
    .query("schoolAssets")
    .withIndex("by_rollback_storage", (q) => q.eq("rollbackStorageId", storageId))) {
    owners.set(String(asset._id), asset);
  }
  return [...owners.values()];
}

async function markLegacyStorageOwnersUnresolved(
  ctx: MutationCtx,
  owners: Doc<"schoolAssets">[],
  storageId: Id<"_storage">,
  code: StorageReconciliationIssueCode,
  now: number,
): Promise<void> {
  for (const owner of owners) {
    await ctx.db.patch(owner._id, {
      validationStatus: "invalid",
      storageReconciliationState: "reconciliation_required",
      updatedAt: now,
    });
    await recordStorageReconciliationIssue(ctx, owner, storageId, code, now);
  }
}

/**
 * Bounded, idempotent deployment backfill for asset rows created before
 * validation and storage-bucket accounting were introduced. Rows with missing
 * or multiply-owned legacy storage remain uninitialized for reconciliation;
 * they never contribute stale byte counts to a bucket baseline.
 */
export const backfillSchoolAssetMetadataBatch = internalMutation({
  args: {
    schoolId: v.id("schools"),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 50, 1), 100);
    const page = await ctx.db
      .query("schoolAssets")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });
    const uninitialized = page.page.filter((asset) => asset.storageAccountingInitializedAt === undefined);
    const allocation = uninitialized.length === 0 ? null : await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) => q.eq("schoolId", args.schoolId).eq("meterType", "storage_bytes"))
      .unique();
    if (uninitialized.length > 0 && !allocation) {
      throw new ConvexError("Storage quota allocation is required before asset accounting migration");
    }

    const now = Date.now();
    let active = 0;
    let trash = 0;
    let temp = 0;
    let migratedCount = 0;
    let missingStorageCount = 0;
    const unresolvedAssetIds = new Set<string>();
    const duplicateStorageIds = new Set<string>();

    for (const asset of uninitialized) {
      const storageIds = [asset.storageId];
      if (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId) {
        storageIds.push(asset.rollbackStorageId);
      }

      let unresolved = false;
      for (const storageId of storageIds) {
        const owners = await ownersOfStorage(ctx, storageId);
        const legacyOwners = owners.filter((owner) => owner.storageAccountingInitializedAt === undefined);
        if (owners.length > 1) {
          await markLegacyStorageOwnersUnresolved(
            ctx,
            legacyOwners,
            storageId,
            "duplicate_storage_ownership",
            now,
          );
          for (const owner of legacyOwners) unresolvedAssetIds.add(String(owner._id));
          duplicateStorageIds.add(String(storageId));
          unresolved = true;
        }
      }
      if (unresolved) continue;

      const metadata = await ctx.db.system.get("_storage", asset.storageId);
      const rollbackMetadata = asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId
        ? await ctx.db.system.get("_storage", asset.rollbackStorageId)
        : null;
      if (!metadata || (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId && !rollbackMetadata)) {
        const missingStorageIds = [
          ...(!metadata ? [asset.storageId] : []),
          ...(asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId && !rollbackMetadata
            ? [asset.rollbackStorageId]
            : []),
        ];
        await markLegacyStorageOwnersUnresolved(
          ctx,
          [asset],
          missingStorageIds[0],
          "missing_storage",
          now,
        );
        for (const storageId of missingStorageIds.slice(1)) {
          await recordStorageReconciliationIssue(ctx, asset, storageId, "missing_storage", now);
        }
        unresolvedAssetIds.add(String(asset._id));
        missingStorageCount += 1;
        continue;
      }

      const byteSize = metadata.size;
      if (asset.isTrashed) trash += byteSize;
      else active += byteSize;
      temp += rollbackMetadata?.size ?? 0;
      await ctx.db.patch(asset._id, {
        mimeType: metadata.contentType ?? asset.mimeType,
        byteSize,
        sha256: metadata.sha256,
        validationStatus: asset.validationStatus ?? (
          metadata.contentType && !ALLOWED_MIME_TYPES.has(metadata.contentType) ? "invalid" : "pending"
        ),
        storageAccountingInitializedAt: now,
        storageReconciliationState: undefined,
        updatedAt: now,
      });
      await resolveStorageReconciliationIssues(ctx, asset, storageIds, now);
      migratedCount += 1;
    }

    if (allocation) {
      const activeStorageBytes = (allocation.activeStorageBytes ?? 0) + active;
      const trashStorageBytes = (allocation.trashStorageBytes ?? 0) + trash;
      const tempStorageBytes = (allocation.tempStorageBytes ?? 0) + temp;
      await ctx.db.patch(allocation._id, {
        activeStorageBytes,
        trashStorageBytes,
        tempStorageBytes,
        consumedUnits: allocation.consumedUnits + active + trash + temp,
        updatedAt: now,
      });
    }

    return {
      cursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      migratedCount,
      missingStorageCount,
      duplicateStorageOwnershipCount: duplicateStorageIds.size,
      unresolvedCount: unresolvedAssetIds.size,
    };
  },
});
