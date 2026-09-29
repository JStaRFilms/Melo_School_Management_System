import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { validateResetStorage } from "./demoResetStorage";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_SLUG } from "./demoData";
import { resetSeal, subtleSha256 } from "./demoResetDigest";

const accounts = Object.values(DEMO_ACCOUNTS);
function refuse(reason: string): never {
  throw new ConvexError(`Demo auth recovery blocked: ${reason}`);
}

// This checks application links only. Better Auth lives in a separate component;
// the eventual Node caller must look up the email and compare its ID before reconciliation.
async function checkedOperation(ctx: QueryCtx | MutationCtx, operationId: Id<"demoResetOperations">) {
  const op = await ctx.db.get(operationId);
  if (!op || (op.status !== "auth_pending" && op.status !== "ready_to_seed") ||
      op.deletionPhase !== "storage_pending" || op.deletionCursor !== op.inventory.length ||
      op.authIds.length !== 3 || new Set(op.authIds).size !== 3 ||
      op.personIds.length !== 3 || new Set(op.personIds).size !== 3 ||
      !op.storageAcknowledgedIds ||
      op.storageCandidateIds.length > 50 ||
      op.storageAcknowledgedIds.length !== op.storageCandidateIds.length ||
      new Set(op.storageCandidateIds).size !== op.storageCandidateIds.length ||
      new Set(op.storageAcknowledgedIds).size !== op.storageCandidateIds.length ||
      op.storageCandidateIds.some((id) => !op.storageAcknowledgedIds!.includes(id)) ||
      (op.authAcknowledgedIds ?? []).some((id, index) => id !== op.authIds[index]) ||
      (op.status === "ready_to_seed" && op.authAcknowledgedIds?.length !== 3) ||
      (op.status === "auth_pending" && op.authAcknowledgedIds?.length === 3)) refuse("operation phase or progress changed");
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

async function assertDetached(ctx: QueryCtx | MutationCtx, op: Doc<"demoResetOperations">) {
  if (await ctx.db.get(op.schoolId)) refuse("reviewed school still exists");
  await validateResetStorage(ctx, op, op.storageCandidateIds);
  for (const personId of op.personIds) {
    if (await ctx.db.get(personId) ||
        await ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", personId)).first() ||
        await ctx.db.query("users").withIndex("by_person", (q) => q.eq("personId", personId)).first()) refuse("recorded person still linked");
  }
  for (let index = 0; index < 3; index++) {
    const id = op.authIds[index];
    const email = accounts[index].email.trim().toLowerCase();
    const token = `${op.authIssuer}|${id}`;
    if (await ctx.db.query("users").withIndex("by_auth", (q) => q.eq("authId", id)).first() ||
        await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first() ||
        await ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", token)).first() ||
        await ctx.db.query("platformAdmins").withIndex("by_auth", (q) => q.eq("authId", id)).first() ||
        await ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", email)).first() ||
        await ctx.db.query("platformAdmins").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", token)).first() ||
        await ctx.db.query("admissionsGuardians").withIndex("by_better_auth_user_id", (q) => q.eq("betterAuthUserId", id)).first() ||
        await ctx.db.query("admissionsGuardians").withIndex("by_normalized_email", (q) => q.eq("normalizedEmail", email)).first() ||
        await ctx.db.query("admissionsGuardians").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", token)).first()) refuse(`credential ${index + 1} still linked`);
    // A person with this email or canonical token may carry a foreign branch
    // membership even when the originally recorded person has been removed.
    for (const person of [
      await ctx.db.query("persons").withIndex("by_email", (q) => q.eq("email", email)).first(),
      await ctx.db.query("persons").withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", token)).first(),
    ]) {
      if (person) refuse(`credential ${index + 1} has a person or foreign membership`);
    }
  }
}

export const checkDemoResetAuthDetachedInternal = internalQuery({
  args: { operationId: v.id("demoResetOperations") },
  returns: v.array(v.object({ index: v.number(), authId: v.string(), email: v.string(), acknowledged: v.boolean() })),
  handler: async (ctx, { operationId }) => {
    const op = await checkedOperation(ctx, operationId);
    await assertDetached(ctx, op);
    return accounts.map((account, index) => ({ index, authId: op.authIds[index],
      email: account.email.trim().toLowerCase(), acknowledged: (op.authAcknowledgedIds?.length ?? 0) > index }));
  },
});

// Acknowledgment is not an auth write. Only the future Node action may run
// findExistingAuthId and reconcileAuthUser, in that order for each account.
export const acknowledgeDemoResetAuthInternal = internalMutation({
  args: { operationId: v.id("demoResetOperations"), index: v.number(), authId: v.string() },
  returns: v.object({ status: v.union(v.literal("auth_pending"), v.literal("ready_to_seed")), acknowledged: v.number() }),
  handler: async (ctx, { operationId, index, authId }) => {
    const op = await checkedOperation(ctx, operationId);
    if (!Number.isInteger(index) || index < 0 || index >= 3 || op.authIds[index] !== authId) refuse("wrong recorded auth ID");
    await assertDetached(ctx, op);
    const progress = op.authAcknowledgedIds ?? [];
    if (index > progress.length) refuse("auth accounts must be reconciled sequentially");
    const acknowledged = index === progress.length ? [...progress, authId] : progress;
    const status: "ready_to_seed" | "auth_pending" = acknowledged.length === 3 ? "ready_to_seed" : "auth_pending";
    if (op.status !== status || acknowledged.length !== progress.length) {
      await ctx.db.patch(operationId, { authAcknowledgedIds: acknowledged, status });
    }
    return { status, acknowledged: acknowledged.length };
  },
});
