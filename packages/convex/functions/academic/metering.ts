import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { isGroupPlatformOperator } from "./groups";
import { requireCapability } from "./rbac";

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
  status: Doc<"usageQuotaReservations">["status"];
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

function reservationResult(reservation: Doc<"usageQuotaReservations">): QuotaReservationResult {
  return {
    allowed: reservation.allowed,
    status: reservation.status,
    reservationId: reservation.idempotencyKey,
    shortfall: reservation.shortfall,
    thresholdAlert: reservation.allowed ? calculateThresholdAlert(reservation.utilizationPercent) : "hard_stop",
    allocatedUnits: reservation.allocatedUnits,
    consumedUnits: reservation.consumedUnits,
    reservedUnits: reservation.reservedUnits,
    availableUnits: reservation.availableUnits,
    currentUtilizationPercent: reservation.utilizationPercent,
  };
}

/**
 * Allocates or tops up usage quota for a school meter.
 */
export const allocateQuota = internalMutation({
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
    if (!Number.isSafeInteger(args.allocatedUnits) || args.allocatedUnits <= 0) {
      throw new ConvexError("Allocated units must be greater than zero");
    }

    const warning = args.warningThresholdPercent ?? 75;
    const critical = args.criticalThresholdPercent ?? 90;
    const stop = args.hardStopThresholdPercent ?? 100;
    if (warning !== 75 || critical !== 90 || stop !== 100) {
      throw new ConvexError("Custom thresholds require versioned plan entitlement support; only 75/90/100 is supported");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();

    if (existing) {
      if (!Number.isSafeInteger(existing.allocatedUnits + args.allocatedUnits)) {
        throw new ConvexError("Allocation exceeds safe integer range");
      }
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
        activeStorageBytes: 0,
        trashStorageBytes: 0,
        tempStorageBytes: 0,
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
export const reserveUsageQuota = internalMutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(
      v.literal("ai_tokens"),
      v.literal("ocr_pages"),
      v.literal("storage_bytes")
    ),
    unitsRequested: v.number(),
    idempotencyKey: v.string(),
    operationName: v.string(),
  },
  handler: async (ctx, args): Promise<QuotaReservationResult> => {
    if (!Number.isSafeInteger(args.unitsRequested) || args.unitsRequested <= 0) throw new ConvexError("Units requested must be a positive safe integer");
    if (!args.idempotencyKey.trim() || args.idempotencyKey.length > 128 || !args.operationName.trim() || args.operationName.length > 128) {
      throw new ConvexError("Bounded operation and idempotency identifiers are required");
    }

    const existing = await ctx.db
      .query("usageQuotaReservations")
      .withIndex("by_school_and_meter_and_idempotency_key", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType).eq("idempotencyKey", args.idempotencyKey)
      )
      .unique();
    if (existing) {
      if (existing.unitsReserved !== args.unitsRequested || existing.operationName !== args.operationName) {
        throw new ConvexError("Idempotency key is already bound to a different usage reservation");
      }
      return reservationResult(existing);
    }

    const now = Date.now();
    const allocation = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)
      )
      .first();
    const allocatedUnits = allocation?.allocatedUnits ?? 0;
    const consumedUnits = allocation?.consumedUnits ?? 0;
    const currentReservedUnits = allocation?.reservedUnits ?? 0;
    const availableUnits = Math.max(0, allocatedUnits - consumedUnits - currentReservedUnits);
    const allowed = args.unitsRequested <= availableUnits;
    const reservedUnits = allowed ? currentReservedUnits + args.unitsRequested : currentReservedUnits;
    const utilizationPercent = allocatedUnits === 0
      ? 100
      : Math.min(100, Math.round(((consumedUnits + reservedUnits) / allocatedUnits) * 100));
    const shortfall = allowed ? undefined : args.unitsRequested - availableUnits;

    if (allowed && allocation) {
      await ctx.db.patch(allocation._id, { reservedUnits, updatedAt: now });
    }
    const reservationId = await ctx.db.insert("usageQuotaReservations", {
      schoolId: args.schoolId,
      meterType: args.meterType,
      idempotencyKey: args.idempotencyKey,
      operationName: args.operationName,
      unitsReserved: args.unitsRequested,
      status: allowed ? "reserved" : "rejected",
      allowed,
      shortfall,
      allocatedUnits,
      consumedUnits,
      reservedUnits,
      availableUnits: allowed ? availableUnits - args.unitsRequested : availableUnits,
      utilizationPercent,
      createdAt: now,
      updatedAt: now,
    });
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) throw new ConvexError("Usage reservation was not persisted");
    return reservationResult(reservation);
  },
});

/**
 * Commits reserved units upon successful completion of operation.
 * Decrements reservedUnits, increments consumedUnits, and records pseudonymized usage event.
 * Invariant: ZERO raw document/prompt payloads in billing tables!
 */
export const commitUsageQuota = internalMutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(v.literal("ai_tokens"), v.literal("ocr_pages"), v.literal("storage_bytes")),
    idempotencyKey: v.string(),
    operationName: v.string(),
    description: v.string(),
    actualUnits: v.number(),
    measurementMetadata: v.object({
      source: v.string(),
      measuredAt: v.number(),
      reference: v.optional(v.string()),
    }),
    actorUserId: v.optional(v.id("users")),
    actorPersonId: v.optional(v.id("persons")),
  },
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.actualUnits) || args.actualUnits < 0) {
      throw new ConvexError("Actual usage must be a non-negative safe integer");
    }
    const reservation = await ctx.db.query("usageQuotaReservations")
      .withIndex("by_school_and_meter_and_idempotency_key", (q) => q.eq("schoolId", args.schoolId).eq("meterType", args.meterType).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (!reservation || !reservation.allowed) throw new ConvexError("Usage reservation was not accepted");
    if (reservation.operationName !== args.operationName) throw new ConvexError("Reservation operation does not match");
    if (args.actualUnits > reservation.unitsReserved) throw new ConvexError("Actual usage exceeds the validated reservation");
    if (reservation.status === "committed") {
      if (reservation.actualUnits !== args.actualUnits) throw new ConvexError("Committed actual usage does not match this idempotency key");
      return { success: true, totalConsumed: reservation.consumedUnits, reservedUnits: reservation.reservedUnits, remainingUnits: reservation.availableUnits, allocatedUnits: reservation.allocatedUnits, utilizationPercent: reservation.utilizationPercent };
    }
    if (reservation.status !== "reserved") throw new ConvexError("Only reserved usage can be committed");

    const allocation = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)).first();
    if (!allocation || allocation.reservedUnits < reservation.unitsReserved) throw new ConvexError("Usage reservation is no longer available");
    const now = Date.now();
    // Settle the exact measured amount and release the entire held amount in the
    // same transaction; the unused portion never becomes consumed quota.
    const reservedUnits = allocation.reservedUnits - reservation.unitsReserved;
    const consumedUnits = allocation.consumedUnits + args.actualUnits;
    const availableUnits = Math.max(0, allocation.allocatedUnits - consumedUnits - reservedUnits);
    const utilizationPercent = allocation.allocatedUnits === 0 ? 100 : Math.min(100, Math.round(((consumedUnits + reservedUnits) / allocation.allocatedUnits) * 100));
    await ctx.db.patch(allocation._id, { reservedUnits, consumedUnits, updatedAt: now });
    await ctx.db.insert("usageEvents", { schoolId: args.schoolId, meterType: args.meterType, unitsDelta: args.actualUnits, reservationId: args.idempotencyKey, measurementMetadata: args.measurementMetadata, actorUserId: args.actorUserId, actorPersonId: args.actorPersonId, operationName: args.operationName, description: args.description, timestamp: now });
    await ctx.db.patch(reservation._id, { status: "committed", actualUnits: args.actualUnits, measurementMetadata: args.measurementMetadata, consumedUnits, reservedUnits, availableUnits, utilizationPercent, committedAt: now, updatedAt: now });
    return { success: true, totalConsumed: consumedUnits, reservedUnits, remainingUnits: availableUnits, allocatedUnits: allocation.allocatedUnits, utilizationPercent };
  },
});

/**
 * Releases reserved units if an operation fails or is aborted.
 */
export const releaseUsageQuota = internalMutation({
  args: {
    schoolId: v.id("schools"),
    meterType: v.union(v.literal("ai_tokens"), v.literal("ocr_pages"), v.literal("storage_bytes")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.query("usageQuotaReservations")
      .withIndex("by_school_and_meter_and_idempotency_key", (q) => q.eq("schoolId", args.schoolId).eq("meterType", args.meterType).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (!reservation || !reservation.allowed) throw new ConvexError("Usage reservation was not accepted");
    if (reservation.status === "released") return { success: true, reservedUnits: reservation.reservedUnits, remainingUnits: reservation.availableUnits, allocatedUnits: reservation.allocatedUnits };
    if (reservation.status !== "reserved") throw new ConvexError("Only reserved usage can be released");

    const allocation = await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", args.schoolId).eq("meterType", args.meterType)).first();
    if (!allocation || allocation.reservedUnits < reservation.unitsReserved) throw new ConvexError("Usage reservation is no longer available");
    const now = Date.now();
    const reservedUnits = allocation.reservedUnits - reservation.unitsReserved;
    const availableUnits = Math.max(0, allocation.allocatedUnits - allocation.consumedUnits - reservedUnits);
    await ctx.db.patch(allocation._id, { reservedUnits, updatedAt: now });
    await ctx.db.patch(reservation._id, { status: "released", reservedUnits, availableUnits, utilizationPercent: Math.min(100, Math.round(((allocation.consumedUnits + reservedUnits) / allocation.allocatedUnits) * 100)), releasedAt: now, updatedAt: now });
    return { success: true, reservedUnits, remainingUnits: availableUnits, allocatedUnits: allocation.allocatedUnits };
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
    await requireCapability(ctx, args.schoolId, "finance.reports.view");
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
        .withIndex("by_school_and_meter", (q) => q.eq("schoolId", args.schoolId))
        .take(4);
      if (allocations.length > 3) throw new ConvexError("Duplicate usage allocations require reconciliation");
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
        activeStorageBytes: alloc.activeStorageBytes ?? null,
        trashStorageBytes: alloc.trashStorageBytes ?? null,
        tempStorageBytes: alloc.tempStorageBytes ?? null,
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
    await requireCapability(ctx, args.schoolId, "finance.reports.view");
    if (args.limit !== undefined && (!Number.isSafeInteger(args.limit) || args.limit < 1)) throw new ConvexError("Limit must be a positive integer");
    const limit = Math.min(args.limit ?? 50, 100);

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

/** Trusted adapter seam only; this does not charge customers or prove a provider is connected. */
export const recordProviderCost = internalMutation({
  args: {
    schoolId: v.id("schools"), operationId: v.string(), evidenceId: v.string(),
    provider: v.string(), model: v.string(),
    outcome: v.union(v.literal("succeeded"), v.literal("failed"), v.literal("unknown")),
    currency: v.string(), costMinor: v.number(),
    inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()),
    pages: v.optional(v.number()), bytes: v.optional(v.number()), measuredAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const value of [args.operationId, args.evidenceId, args.provider, args.model]) {
      if (!value.trim() || value.length > 128) throw new ConvexError("Bounded accounting identifiers required");
    }
    if (!/^[A-Z]{3}$/.test(args.currency)) throw new ConvexError("Explicit uppercase currency required");
    for (const value of [args.costMinor, args.inputTokens, args.outputTokens, args.pages, args.bytes, args.measuredAt]) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new ConvexError("Cost and dimensions must be non-negative safe integers");
    }
    if (!(await ctx.db.get(args.schoolId))) throw new ConvexError("School not found");
    const existing = await ctx.db.query("usageProviderCosts")
      .withIndex("by_provider_and_evidenceId", q => q.eq("provider", args.provider).eq("evidenceId", args.evidenceId)).unique();
    if (existing) {
      const keys: Array<keyof typeof args> = ["schoolId", "operationId", "evidenceId", "provider", "model", "outcome", "currency", "costMinor", "inputTokens", "outputTokens", "pages", "bytes", "measuredAt"];
      if (keys.some(key => existing[key] !== args[key])) {
        throw new ConvexError("Conflicting provider evidence retry");
      }
      return existing._id;
    }
    return await ctx.db.insert("usageProviderCosts", args);
  },
});

export const getPlatformUsageCosts = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    if (!(await isGroupPlatformOperator(ctx))) throw new ConvexError("Forbidden: active Platform authority required");
    const rows = await ctx.db.query("usageProviderCosts")
      .withIndex("by_school_and_measuredAt", q => q.eq("schoolId", args.schoolId))
      .order("desc").take(101);
    return {
      truncated: rows.length > 100,
      providerExecutionAvailable: false,
      rows: rows.slice(0, 100).map(({ evidenceId: _evidence, ...row }) => row),
    };
  },
});
