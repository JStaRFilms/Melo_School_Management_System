import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";

/**
 * Commercial Catalog & Settlement Transparency Engine (F7 / MX-12)
 *
 * Enforces:
 * 1. Routing Mode Separation: Mode A (Direct School Merchant - 100% direct settlement)
 *    vs. Mode B (Melo-Routed Split Subaccount).
 * 2. Truthful Clearing Disclosures: Discloses NIBSS T+1 clearing reality;
 *    universal "next-day" or "instant" clearing promises are strictly prohibited.
 * 3. Seed Catalog: Core/Basic seeded at ₦1,000 per active student per term + ₦30,000 setup fee.
 */

export const CORE_BASIC_PLAN_CODE = "core_basic";
export const CORE_BASIC_PER_STUDENT_KOBO = 100_000; // ₦1,000 in kobo
export const CORE_BASIC_SETUP_FEE_KOBO = 3_000_000; // ₦30,000 in kobo

export const NIBSS_CLEARING_NOTICE =
  "Estimated Settlement: Next business day (Subject to NIBSS banking schedules, weekend clearing freezes, and statutory holidays. Universal next-day clearing claims are strictly prohibited under Central Bank of Nigeria and NIBSS operational regulations).";

export interface SettlementBreakdown {
  grossAmountKobo: number;
  paystackFeeKobo: number;
  platformFeeKobo: number;
  netPayoutKobo: number;
  clearingCycle: "NIBSS_T_PLUS_1";
  estimatedSettlementDate: number;
  settlementNotice: string;
}

/**
 * Pure calculation helper for Mode A vs Mode B settlement mathematics.
 */
export function calculateSettlementBreakdown(params: {
  grossAmountKobo: number;
  routingMode: "mode_a_direct" | "mode_b_split";
  customPaystackFeeKobo?: number;
  customPlatformFeeKobo?: number;
  now?: number;
}): SettlementBreakdown {
  const { grossAmountKobo, routingMode } = params;
  if (grossAmountKobo <= 0) {
    throw new ConvexError("Gross transaction amount must be greater than zero");
  }

  const now = params.now ?? Date.now();
  // Estimated T+1 business day (24 hours window baseline)
  const estimatedSettlementDate = now + 24 * 60 * 60 * 1000;

  // Paystack standard fee in Nigeria: 1.5% capped at ₦2,000 (200,000 kobo)
  const defaultPaystackFee = Math.min(
    Math.round(grossAmountKobo * 0.015),
    200_000
  );
  const paystackFeeKobo = params.customPaystackFeeKobo !== undefined
    ? params.customPaystackFeeKobo
    : defaultPaystackFee;

  let platformFeeKobo = 0;
  let netPayoutKobo = 0;

  if (routingMode === "mode_a_direct") {
    // Mode A: Direct School Merchant Mode (Trust-First Default)
    // Parent payments settle 100% directly to school bank account minus Paystack processing fee.
    // Melo platform charges ZERO surcharge on school tuition in Mode A.
    // (SaaS billing is invoiced independently: ₦1,000/student/term).
    platformFeeKobo = 0;
    netPayoutKobo = grossAmountKobo - paystackFeeKobo;
  } else {
    // Mode B: Melo-Routed Paystack Subaccount / Split Mode
    // Melo acts as primary merchant; splits payment between School subaccount and Melo platform surcharge.
    // Default platform surcharge is 1.0% or custom surcharge.
    const defaultPlatformFee = Math.round(grossAmountKobo * 0.01);
    platformFeeKobo = params.customPlatformFeeKobo !== undefined
      ? params.customPlatformFeeKobo
      : defaultPlatformFee;
    netPayoutKobo = grossAmountKobo - paystackFeeKobo - platformFeeKobo;
  }

  if (netPayoutKobo < 0) {
    throw new ConvexError(
      `Calculated net payout (${netPayoutKobo} kobo) cannot be negative. Fees exceed gross amount.`
    );
  }

  // Strict double-entry balance assertion: Debits == Credits
  const feeSum = paystackFeeKobo + platformFeeKobo + netPayoutKobo;
  if (feeSum !== grossAmountKobo) {
    throw new ConvexError(
      `Settlement ledger imbalance: gross (${grossAmountKobo}) != sum of fees and payout (${feeSum})`
    );
  }

  return {
    grossAmountKobo,
    paystackFeeKobo,
    platformFeeKobo,
    netPayoutKobo,
    clearingCycle: "NIBSS_T_PLUS_1",
    estimatedSettlementDate,
    settlementNotice: NIBSS_CLEARING_NOTICE,
  };
}

/**
 * Seeds the commercial catalog with Core/Basic subscription rate card.
 * Idempotent: If "core_basic" already exists, returns existing plan.
 */
export const seedCommercialCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_code", (q) => q.eq("code", CORE_BASIC_PLAN_CODE))
      .first();

    if (existing) {
      return existing;
    }

    const now = Date.now();
    const planId = await ctx.db.insert("subscriptionPlans", {
      code: CORE_BASIC_PLAN_CODE,
      name: "Core / Basic",
      description:
        "Baseline Melo institutional subscription: Core academic management, gradebooks, attendance, and parent portals.",
      perStudentFeeKobo: CORE_BASIC_PER_STUDENT_KOBO,
      termSetupFeeKobo: CORE_BASIC_SETUP_FEE_KOBO,
      currency: "NGN",
      billingCadence: "termly",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(planId);
  },
});

/**
 * Records a settlement transaction into the double-entry settlement ledger.
 * Validates Mode A vs Mode B fee breakdown, asserts clearing cycle disclosure,
 * and records an immutable audit log.
 */
export const recordSettlementTransaction = mutation({
  args: {
    schoolId: v.id("schools"),
    transactionRef: v.string(),
    routingMode: v.union(v.literal("mode_a_direct"), v.literal("mode_b_split")),
    grossAmountKobo: v.number(),
    paystackFeeKobo: v.optional(v.number()),
    platformFeeKobo: v.optional(v.number()),
    destinationAccount: v.optional(v.string()),
    metadata: v.optional(v.any()),
    actorUserId: v.optional(v.id("users")),
    actorPersonId: v.optional(v.id("persons")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Prevent duplicate references for the same school
    const existing = await ctx.db
      .query("settlementLedgers")
      .withIndex("by_school_and_ref", (q) =>
        q.eq("schoolId", args.schoolId).eq("transactionRef", args.transactionRef)
      )
      .first();

    if (existing) {
      throw new ConvexError(
        `Settlement transaction with reference '${args.transactionRef}' has already been recorded.`
      );
    }

    // Calculate settlement breakdown
    const breakdown = calculateSettlementBreakdown({
      grossAmountKobo: args.grossAmountKobo,
      routingMode: args.routingMode,
      customPaystackFeeKobo: args.paystackFeeKobo,
      customPlatformFeeKobo: args.platformFeeKobo,
      now,
    });

    const ledgerId = await ctx.db.insert("settlementLedgers", {
      schoolId: args.schoolId,
      transactionRef: args.transactionRef,
      routingMode: args.routingMode,
      grossAmountKobo: breakdown.grossAmountKobo,
      paystackFeeKobo: breakdown.paystackFeeKobo,
      platformFeeKobo: breakdown.platformFeeKobo,
      netPayoutKobo: breakdown.netPayoutKobo,
      currency: "NGN",
      clearingCycle: "NIBSS_T_PLUS_1",
      estimatedSettlementDate: breakdown.estimatedSettlementDate,
      settlementNotice: breakdown.settlementNotice,
      destinationAccount: args.destinationAccount,
      status: "pending_clearing",
      metadata: args.metadata,
      createdAt: now,
    });

    // Record audit event
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.actorUserId ? "user" : "system",
      actorPersonId: args.actorPersonId,
      actorEmailSnapshot: "billing-system@melo.internal",
      module: "commercial",
      action: "settlement.transaction_recorded",
      targetType: "settlementLedger",
      targetId: ledgerId,
      outcome: "success",
      safeSummary: `Settlement recorded for ${args.transactionRef} [${args.routingMode}]: Gross ₦${(
        breakdown.grossAmountKobo / 100
      ).toLocaleString()}, Paystack ₦${(
        breakdown.paystackFeeKobo / 100
      ).toLocaleString()}, Platform ₦${(
        breakdown.platformFeeKobo / 100
      ).toLocaleString()}, Net Payout ₦${(
        breakdown.netPayoutKobo / 100
      ).toLocaleString()} (Clearing: NIBSS T+1)`,
    });

    const record = await ctx.db.get(ledgerId);
    return {
      record,
      breakdown,
    };
  },
});

/**
 * Queries settlement ledger records with full transparent fee breakdowns.
 */
export const getSettlementLedger = query({
  args: {
    schoolId: v.id("schools"),
    routingMode: v.optional(
      v.union(v.literal("mode_a_direct"), v.literal("mode_b_split"))
    ),
    status: v.optional(
      v.union(
        v.literal("pending_clearing"),
        v.literal("settled"),
        v.literal("held_dispute"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    let queryBuilder = ctx.db
      .query("settlementLedgers")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId));

    if (args.status) {
      queryBuilder = ctx.db
        .query("settlementLedgers")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", args.schoolId).eq("status", args.status!)
        );
    }

    const records = await queryBuilder.order("desc").take(limit * 2);

    const filtered = records.filter((r) => {
      if (args.routingMode && r.routingMode !== args.routingMode) return false;
      return true;
    });

    return filtered.slice(0, limit);
  },
});

/**
 * Retrieve single settlement ledger record by transaction reference.
 */
export const getSettlementByRef = query({
  args: {
    schoolId: v.id("schools"),
    transactionRef: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settlementLedgers")
      .withIndex("by_school_and_ref", (q) =>
        q.eq("schoolId", args.schoolId).eq("transactionRef", args.transactionRef)
      )
      .first();
  },
});

/**
 * Creates or updates a school's institutional subscription.
 * Calculates termly platform fee based on active student count + setup fee status.
 */
export const createOrUpdateSchoolSubscription = mutation({
  args: {
    schoolId: v.id("schools"),
    planCode: v.optional(v.string()),
    activeStudentCount: v.number(),
    setupFeePaid: v.optional(v.boolean()),
    paymentRoutingMode: v.union(
      v.literal("mode_a_direct"),
      v.literal("mode_b_split")
    ),
    subaccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.planCode ?? CORE_BASIC_PLAN_CODE;
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!plan) {
      throw new ConvexError(`Subscription plan with code '${code}' not found.`);
    }

    const now = Date.now();
    const setupFeePaid = args.setupFeePaid ?? false;
    const currentTermFeeKobo =
      args.activeStudentCount * plan.perStudentFeeKobo +
      (setupFeePaid ? 0 : plan.termSetupFeeKobo);

    const existing = await ctx.db
      .query("schoolSubscriptions")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        planId: plan._id,
        activeStudentCount: args.activeStudentCount,
        currentTermFeeKobo,
        setupFeePaid,
        paymentRoutingMode: args.paymentRoutingMode,
        subaccountId: args.subaccountId ?? existing.subaccountId,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    } else {
      const subId = await ctx.db.insert("schoolSubscriptions", {
        schoolId: args.schoolId,
        planId: plan._id,
        status: "active",
        activeStudentCount: args.activeStudentCount,
        currentTermFeeKobo,
        setupFeePaid,
        paymentRoutingMode: args.paymentRoutingMode,
        subaccountId: args.subaccountId,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(subId);
    }
  },
});

/**
 * Returns current school subscription.
 */
export const getSchoolSubscription = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("schoolSubscriptions")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (!sub) return null;

    const plan = await ctx.db.get(sub.planId);
    return {
      ...sub,
      plan,
    };
  },
});

/**
 * Returns all active subscription plans in commercial catalog.
 */
export const listSubscriptionPlans = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("subscriptionPlans")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});
