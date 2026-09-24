import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { collectStorageClaimInventory } from "./assetStorageBoundary";
import { DEMO_SCHOOL_SLUG } from "./demoData";
import { resetSeal, subtleSha256 } from "./demoResetDigest";

function refuse(reason: string): never {
  throw new ConvexError(`Demo storage cleanup blocked: ${reason}`);
}

async function checkedCandidate(
  ctx: QueryCtx | MutationCtx,
  operationId: Id<"demoResetOperations">,
  storageId: Id<"_storage">,
) {
  const op = await ctx.db.get(operationId);
  if (!op || (op.status !== "storage_pending" && op.status !== "auth_pending") ||
      op.deletionPhase !== "storage_pending" ||
      op.deletionCursor !== op.inventory.length ||
      op.storageCandidateIds.length > 50 ||
      !op.storageCandidateIds.includes(storageId) ||
      op.retainedStorageIds.length !== 37 || new Set(op.retainedStorageIds).size !== 37 ||
      op.retainedStorageIds.some((id) => !op.storageCandidateIds.includes(id)) ||
      !op.storageAcknowledgedIds ||
      new Set(op.storageCandidateIds).size !== op.storageCandidateIds.length ||
      op.storageAcknowledgedIds.some((id) => !op.storageCandidateIds.includes(id)) ||
      new Set(op.storageAcknowledgedIds).size !== op.storageAcknowledgedIds.length ||
      (op.status === "auth_pending" && op.storageAcknowledgedIds.length !== op.storageCandidateIds.length) ||
      (op.status === "storage_pending" && op.storageAcknowledgedIds.length === op.storageCandidateIds.length)) {
    refuse("operation or candidate is not in the reviewed storage phase");
  }
  if (process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !process.env.CONVEX_CLOUD_URL ||
      op.cloudUrl !== process.env.CONVEX_CLOUD_URL ||
      op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
      !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
      op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
      op.schoolSlug !== DEMO_SCHOOL_SLUG) refuse("development target gate failed");
  if (!/^[a-f0-9]{64}$/.test(op.inventoryHash) ||
      await subtleSha256(resetSeal(op)) !== op.inventoryHash) refuse("inventory seal changed");
  return op;
}

export async function validateResetStorage(ctx: QueryCtx | MutationCtx, op: Doc<"demoResetOperations">, ids: Id<"_storage">[]) {
  if (op.storageCandidateIds.length > 50 || ids.length > 50) refuse("candidate inventory exceeds 50");
  const claims = await collectStorageClaimInventory(ctx, ids);
  for (const id of ids) {
    const retained = op.retainedStorageIds.includes(id);
    const owners = claims.get(String(id)) ?? [];
    if (retained ? owners.length !== 0 || !await ctx.db.system.get("_storage", id)
        : owners.length !== 0 || !!await ctx.db.system.get("_storage", id)) {
      refuse(retained ? "retained file missing or has another claim" : "deleted file exists or has claims");
    }
  }
}

// No candidate can be acknowledged when the reviewed inventory contains no
// blobs. This transaction advances that empty phase without inventing an ID.
export const finishEmptyDemoResetStorageInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.literal("auth_pending"),
  handler: async (ctx, { operationId }) => {
    const op = await ctx.db.get(operationId);
    if (!op || op.status !== "storage_pending" || op.deletionPhase !== "storage_pending" ||
        op.deletionCursor !== op.inventory.length || op.storageCandidateIds.length !== 0 ||
        op.storageAcknowledgedIds?.length !== 0 ||
        process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || !process.env.CONVEX_CLOUD_URL ||
        op.cloudUrl !== process.env.CONVEX_CLOUD_URL || op.cloudUrl !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
        !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY || op.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY ||
        op.schoolSlug !== DEMO_SCHOOL_SLUG || await ctx.db.get(op.schoolId) ||
        await subtleSha256(resetSeal(op)) !== op.inventoryHash) refuse("empty storage phase changed");
    await ctx.db.patch(operationId, { status: "auth_pending" });
    return "auth_pending" as const;
  },
});

// Claim check, blob deletion, and progress update share one transaction.
export const processDemoResetStorageCandidateInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations"), storageId: v.id("_storage") },
  returns: v.object({ status: v.union(v.literal("storage_pending"), v.literal("auth_pending")), acknowledged: v.number() }),
  handler: async (ctx, { operationId, storageId }) => {
    const op: Doc<"demoResetOperations"> = await checkedCandidate(ctx, operationId, storageId);
    const retained = op.retainedStorageIds.includes(storageId);
    const claims = await collectStorageClaimInventory(ctx, [storageId]);
    if ((claims.get(String(storageId)) ?? []).length) refuse("candidate has another claim");
    const exists = !!await ctx.db.system.get("_storage", storageId);
    if (retained && !exists) refuse("retained file missing");
    if (!retained && exists) await ctx.storage.delete(storageId);
    // A missing nonretained file is valid on an interrupted retry.
    const acknowledged = op.storageAcknowledgedIds!.includes(storageId)
      ? op.storageAcknowledgedIds!
      : [...op.storageAcknowledgedIds!, storageId];
    const status: "auth_pending" | "storage_pending" = acknowledged.length === op.storageCandidateIds.length ? "auth_pending" : "storage_pending";
    if (status === "auth_pending") {
      // Earlier acknowledgments are progress, not proof that those blobs and
      // claims are still absent when the final candidate advances the phase.
      await validateResetStorage(ctx, op, op.storageCandidateIds);
    }
    if (status !== op.status || acknowledged.length !== op.storageAcknowledgedIds!.length) {
      await ctx.db.patch(operationId, { storageAcknowledgedIds: acknowledged, status });
    }
    return { status, acknowledged: acknowledged.length };
  },
});
