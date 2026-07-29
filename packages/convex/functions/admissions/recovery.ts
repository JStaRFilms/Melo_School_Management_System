import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const MAX_BATCH = 100;
const DEFAULT_STALE_MS = 15 * 60 * 1000;

/**
 * Bounded global recovery sweep. It never retries a conversion without the
 * operator-approved inputs; it exposes the existing ledger as retryable and
 * returns abandoned outbox leases to the pending delivery queue.
 */
export const sweep = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
    staleAfterMs: v.optional(v.number()),
  },
  returns: v.object({ conversionsRecovered: v.number(), outboxRecovered: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), MAX_BATCH);
    const staleBefore = now - Math.max(args.staleAfterMs ?? DEFAULT_STALE_MS, 60_000);

    const conversions = await ctx.db
      .query("admissionsConversions")
      .withIndex("by_state_and_updated_at", (q) => q.eq("state", "running").lte("updatedAt", staleBefore))
      .take(limit);
    for (const conversion of conversions) {
      await ctx.db.patch("admissionsConversions", conversion._id, {
        state: "failed_retryable",
        errorCode: "STALE_LEASE",
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      await ctx.db.insert("admissionsConversionAttempts", {
        schoolId: conversion.schoolId,
        conversionId: conversion._id,
        attemptNumber: (conversion.attemptCount ?? 0) + 1,
        workerKey: "scheduled_recovery",
        outcome: "retryable_failure",
        errorCode: "STALE_LEASE",
        startedAt: now,
        finishedAt: now,
        createdAt: now,
      });
    }

    const abandonedOutbox = await ctx.db
      .query("admissionsCommunicationOutbox")
      .withIndex("by_state_and_next_attempt_at", (q) => q.eq("state", "sending").lte("nextAttemptAt", staleBefore))
      .take(limit);
    for (const message of abandonedOutbox) {
      await ctx.db.patch("admissionsCommunicationOutbox", message._id, {
        state: "pending",
        nextAttemptAt: now,
        updatedAt: now,
      });
    }

    return { conversionsRecovered: conversions.length, outboxRecovered: abandonedOutbox.length };
  },
});
