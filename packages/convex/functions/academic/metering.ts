import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";

/**
 * Deterministic Usage Metering & Quota Threshold Protection Engine (H8 / MX-13)
 *
 * Invariants:
 * 1. Two-Phase Reservation Pattern: Pre-flight reservation prevents overdrafts
 *    on heavy batch operations (OCR, AI extraction).
 * 2. Strict Threshold Enforcement:
 *    - >= 75%: Warning notice
 *    - >= 90%: Urgent warning banner
 *    - >= 100% or Shortfall: Hard-stop execution denial.
 * 3. Zero Raw Payload Leakage: usageEvents strictly logs pseudonymized accounting metadata;
 *    zero raw prompt texts or document bodies are ever stored in billing tables.
 */

export type MeterType = "ai_tokens" | "ocr_pages" | "storage_bytes";

export type ThresholdAlertLevel =
  | "normal"
  | "notice_75"
  | "warning_90"
  | "hard_stop";

export interface QuotaReservationResult {
  allowed: boolean;
  reservationId: string;
  shortfall?: number;
  thresholdAlert: ThresholdAlertLevel;
  allocatedUnits: number;
  consumedUnits: number;
  reservedUnits: number;
  availableUnits: number;
  currentUtilizationPercent: number;
}

/**
 * Calculates the threshold alert tier based on utilization percentage.
 */
export function calculateThresholdAlert(
  utilizationPercent: number
): ThresholdAlertLevel {
  if (utilizationPercent >= 100) return "hard_stop";
  if (utilizationPercent >= 90) return "warning_90";
  if (utilizationPercent >= 75) return "notice_75";
  return "normal";
}

/**
 * Allocates or tops up usage quota for a school meter.
 */
export const allocateQuota = mutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(
      v.literal("ai_tokens"),
      v.literal("ocr_pages"),
      v.literal("storage_bytes")
    ),
    allocatedUnits: v.number(),
    resetCadence: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("termly"),
        v.literal("prepaid_pack")
      )
    ),
    warningThresholdPercent: v.optional(v.number()),
    criticalThresholdPercent: v.optional(v.number()),
    hardStopThresholdPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.allocatedUnits <= 0) {
      throw new ConvexError("Allocated units must be greater than zero");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        allocatedUnits: existing.allocatedUnits + args.allocatedUnits,
        warningThresholdPercent:
          args.warningThresholdPercent ?? existing.warningThresholdPercent ?? 75,
        criticalThresholdPercent:
          args.criticalThresholdPercent ?? existing.criticalThresholdPercent ?? 90,
        hardStopThresholdPercent:
          args.hardStopThresholdPercent ?? existing.hardStopThresholdPercent ?? 100,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    } else {
      const id = await ctx.db.insert("usageMeterAllocations", {
        schoolId: args.schoolId,
        meterType: args.meterType,
        allocatedUnits: args.allocatedUnits,
        consumedUnits: 0,
        reservedUnits: 0,
        warningThresholdPercent: args.warningThresholdPercent ?? 75,
        criticalThresholdPercent: args.criticalThresholdPercent ?? 90,
        hardStopThresholdPercent: args.hardStopThresholdPercent ?? 100,
        resetCadence: args.resetCadence ?? "termly",
        lastResetAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(id);
    }
  },
});

/**
 * Pre-flight quota reservation before executing expensive AI/OCR/storage tasks.
 * Validates available quota.
 * Returns { allowed: false, shortfall, thresholdAlert: "hard_stop" } if balance exceeded.
 * Atomically increments reservedUnits if quota is sufficient.
 */
export const reserveUsageQuota = mutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(
      v.literal("ai_tokens"),
      v.literal("ocr_pages"),
      v.literal("storage_bytes")
    ),
    unitsRequested: v.number(),
    reservationId: v.optional(v.string()),
    operationName: v.string(),
  },
  handler: async (ctx, args): Promise<QuotaReservationResult> => {
    if (args.unitsRequested <= 0) {
      throw new ConvexError("Units requested must be greater than zero");
    }

    const now = Date.now();
    const reservationId =
      args.reservationId ??
      `res_${now}_${Math.random().toString(36).slice(2, 10)}`;

    const allocation = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();

    if (!allocation) {
      // Zero allocation -> immediate hard-stop shortfall
      return {
        allowed: false,
        reservationId,
        shortfall: args.unitsRequested,
        thresholdAlert: "hard_stop",
        allocatedUnits: 0,
        consumedUnits: 0,
        reservedUnits: 0,
        availableUnits: 0,
        currentUtilizationPercent: 100,
      };
    }

    const availableUnits = Math.max(
      0,
      allocation.allocatedUnits - allocation.consumedUnits - allocation.reservedUnits
    );

    // Hard Stop Check: Insufficient balance
    if (args.unitsRequested > availableUnits) {
      const shortfall = args.unitsRequested - availableUnits;
      const currentUtilizationPercent = Math.min(
        100,
        Math.round(
          ((allocation.consumedUnits + allocation.reservedUnits) /
            allocation.allocatedUnits) *
            100
        )
      );

      return {
        allowed: false,
        reservationId,
        shortfall,
        thresholdAlert: "hard_stop",
        allocatedUnits: allocation.allocatedUnits,
        consumedUnits: allocation.consumedUnits,
        reservedUnits: allocation.reservedUnits,
        availableUnits,
        currentUtilizationPercent,
      };
    }

    // Atomically reserve quota units
    const newReservedUnits = allocation.reservedUnits + args.unitsRequested;
    await ctx.db.patch(allocation._id, {
      reservedUnits: newReservedUnits,
      updatedAt: now,
    });

    const projectedConsumption = allocation.consumedUnits + newReservedUnits;
    const currentUtilizationPercent = Math.min(
      100,
      Math.round((projectedConsumption / allocation.allocatedUnits) * 100)
    );
    const thresholdAlert = calculateThresholdAlert(currentUtilizationPercent);

    return {
      allowed: true,
      reservationId,
      thresholdAlert,
      allocatedUnits: allocation.allocatedUnits,
      consumedUnits: allocation.consumedUnits,
      reservedUnits: newReservedUnits,
      availableUnits: availableUnits - args.unitsRequested,
      currentUtilizationPercent,
    };
  },
});

/**
 * Commits reserved units upon successful completion of operation.
 * Decrements reservedUnits, increments consumedUnits, and records pseudonymized usage event.
 * Invariant: ZERO raw document/prompt payloads in billing tables!
 */
export const commitUsageQuota = mutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(
      v.literal("ai_tokens"),
      v.literal("ocr_pages"),
      v.literal("storage_bytes")
    ),
    unitsCommitted: v.number(),
    reservationId: v.optional(v.string()),
    operationName: v.string(),
    description: v.string(),
    actorUserId: v.optional(v.id("users")),
    actorPersonId: v.optional(v.id("persons")),
  },
  handler: async (ctx, args) => {
    if (args.unitsCommitted <= 0) {
      throw new ConvexError("Units committed must be greater than zero");
    }

    const now = Date.now();
    const allocation = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();

    if (!allocation) {
      throw new ConvexError("No meter allocation found for school");
    }

    const newReserved = Math.max(0, allocation.reservedUnits - args.unitsCommitted);
    const newConsumed = allocation.consumedUnits + args.unitsCommitted;

    await ctx.db.patch(allocation._id, {
      reservedUnits: newReserved,
      consumedUnits: newConsumed,
      updatedAt: now,
    });

    // Append-only usage event (Pseudonymized accounting: NO raw prompts or document text)
    await ctx.db.insert("usageEvents", {
      schoolId: args.schoolId,
      meterType: args.meterType,
      unitsDelta: args.unitsCommitted,
      reservationId: args.reservationId,
      actorUserId: args.actorUserId,
      actorPersonId: args.actorPersonId,
      operationName: args.operationName,
      description: args.description,
      timestamp: now,
    });

    const remainingUnits = Math.max(
      0,
      allocation.allocatedUnits - newConsumed - newReserved
    );

    return {
      success: true,
      totalConsumed: newConsumed,
      reservedUnits: newReserved,
      remainingUnits,
      allocatedUnits: allocation.allocatedUnits,
      utilizationPercent: Math.min(
        100,
        Math.round(((newConsumed + newReserved) / allocation.allocatedUnits) * 100)
      ),
    };
  },
});

/**
 * Releases reserved units if an operation fails or is aborted.
 */
export const releaseUsageQuota = mutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(
      v.literal("ai_tokens"),
      v.literal("ocr_pages"),
      v.literal("storage_bytes")
    ),
    unitsToRelease: v.number(),
    reservationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.unitsToRelease <= 0) {
      throw new ConvexError("Units to release must be greater than zero");
    }

    const now = Date.now();
    const allocation = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();

    if (!allocation) {
      throw new ConvexError("No meter allocation found for school");
    }

    const newReserved = Math.max(0, allocation.reservedUnits - args.unitsToRelease);

    await ctx.db.patch(allocation._id, {
      reservedUnits: newReserved,
      updatedAt: now,
    });

    const remainingUnits = Math.max(
      0,
      allocation.allocatedUnits - allocation.consumedUnits - newReserved
    );

    return {
      success: true,
      reservedUnits: newReserved,
      remainingUnits,
      allocatedUnits: allocation.allocatedUnits,
    };
  },
});

/**
 * Returns current consumption, allocation, and alerts at 75%, 90%, 100%.
 */
export const getUsageStatus = query({
  args: {
    schoolId: v.id("schools"),
    meterType: v.optional(
      v.union(
        v.literal("ai_tokens"),
        v.literal("ocr_pages"),
        v.literal("storage_bytes")
      )
    ),
  },
  handler: async (ctx, args) => {
    let allocations: Doc<"usageMeterAllocations">[] = [];

    if (args.meterType) {
      const single = await ctx.db
        .query("usageMeterAllocations")
        .withIndex("by_school_and_meter", (q) =>
          q.eq("schoolId", args.schoolId).eq("meterType", args.meterType!)
        )
        .first();
      if (single) allocations.push(single);
    } else {
      allocations = await ctx.db
        .query("usageMeterAllocations")
        .filter((q) => q.eq(q.field("schoolId"), args.schoolId))
        .collect();
    }

    const results = allocations.map((alloc) => {
      const activeUsed = alloc.consumedUnits + alloc.reservedUnits;
      const utilizationPercent =
        alloc.allocatedUnits > 0
          ? Math.min(100, Math.round((activeUsed / alloc.allocatedUnits) * 100))
          : 100;
      const thresholdAlert = calculateThresholdAlert(utilizationPercent);
      const availableUnits = Math.max(
        0,
        alloc.allocatedUnits - alloc.consumedUnits - alloc.reservedUnits
      );

      return {
        meterType: alloc.meterType,
        allocatedUnits: alloc.allocatedUnits,
        consumedUnits: alloc.consumedUnits,
        reservedUnits: alloc.reservedUnits,
        availableUnits,
        utilizationPercent,
        thresholdAlert,
        isHardStopped: utilizationPercent >= 100,
        isCritical90: utilizationPercent >= 90 && utilizationPercent < 100,
        isWarning75: utilizationPercent >= 75 && utilizationPercent < 90,
        resetCadence: alloc.resetCadence,
        lastResetAt: alloc.lastResetAt,
      };
    });

    return results;
  },
});

/**
 * Lists pseudonymized usage events for billing transparency.
 */
export const listUsageEvents = query({
  args: {
    schoolId: v.id("schools"),
    meterType: v.optional(
      v.union(
        v.literal("ai_tokens"),
        v.literal("ocr_pages"),
        v.literal("storage_bytes")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    let queryBuilder = ctx.db
      .query("usageEvents")
      .withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", args.schoolId));

    if (args.meterType) {
      queryBuilder = ctx.db
        .query("usageEvents")
        .withIndex("by_school_and_meter", (q) =>
          q.eq("schoolId", args.schoolId).eq("meterType", args.meterType!)
        );
    }

    return await queryBuilder.order("desc").take(limit);
  },
});
