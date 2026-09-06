import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { isGroupPlatformOperator } from "./groups";
import {
  commercialRate,
  APPROVED_CORE_BASIC_RATE,
  validateRate,
  minor,
  priceSnapshot,
  isBillableStudent,
  COMMERCIAL_GATES,
} from "../foundation/commercialContract";
import { recordAuditEventHelper } from "./audit";
import { requireCapability } from "./rbac";

/**
 * Commercial Catalog & Settlement Transparency Engine (F7 / MX-12)
 *
 * Enforces:
 * 1. Routing Mode Separation: Mode A (Direct School Merchant; provider fees separate)
 *    vs. Mode B (Melo-Routed Split Subaccount).
 * 2. Truthful Clearing Disclosures: records only provider evidence; timing is
 *    explicitly unavailable until a trusted provider supplies it.
 * 3. Seed Catalog: Core/Basic seeded at ₦1,000 per active student per term + ₦30,000 setup fee.
 */

export const CORE_BASIC_PLAN_CODE = "core_basic";
export const CORE_BASIC_PER_STUDENT_KOBO =
  APPROVED_CORE_BASIC_RATE.perStudentMinor;
export const CORE_BASIC_SETUP_FEE_KOBO = APPROVED_CORE_BASIC_RATE.setupMinor;

export interface SettlementBreakdown {
  grossAmountKobo: number;
  paystackFeeKobo: number;
  platformFeeKobo: number;
  netPayoutKobo: number;
}

/**
 * Pure calculation helper for Mode A vs Mode B settlement mathematics.
 */
export function calculateSettlementBreakdown(params: {
  grossAmountKobo: number;
  routingMode: "mode_a_direct" | "mode_b_split";
  customPaystackFeeKobo?: number;
  customPlatformFeeKobo?: number;
}): SettlementBreakdown {
  const { grossAmountKobo, routingMode } = params;
  minor(grossAmountKobo);
  if (params.customPaystackFeeKobo !== undefined)
    minor(params.customPaystackFeeKobo);
  if (params.customPlatformFeeKobo !== undefined)
    minor(params.customPlatformFeeKobo);
  if (grossAmountKobo <= 0) {
    throw new ConvexError("Gross transaction amount must be greater than zero");
  }

  if (params.customPaystackFeeKobo === undefined) {
    throw new ConvexError("Provider-reported processing fee is required");
  }
  if (params.customPaystackFeeKobo < 0) {
    throw new ConvexError(
      "Provider-reported processing fee cannot be negative",
    );
  }
  if (
    routingMode === "mode_b_split" &&
    params.customPlatformFeeKobo === undefined
  ) {
    throw new ConvexError("Approved split-mode platform fee is required");
  }
  if ((params.customPlatformFeeKobo ?? 0) < 0) {
    throw new ConvexError("Platform fee cannot be negative");
  }

  const paystackFeeKobo = params.customPaystackFeeKobo;
  const platformFeeKobo =
    routingMode === "mode_a_direct" ? 0 : params.customPlatformFeeKobo!;
  const netPayoutKobo = grossAmountKobo - paystackFeeKobo - platformFeeKobo;

  if (netPayoutKobo < 0) {
    throw new ConvexError(
      `Calculated net payout (${netPayoutKobo} kobo) cannot be negative. Fees exceed gross amount.`,
    );
  }

  // Strict double-entry balance assertion: Debits == Credits
  const feeSum = paystackFeeKobo + platformFeeKobo + netPayoutKobo;
  if (feeSum !== grossAmountKobo) {
    throw new ConvexError(
      `Settlement ledger imbalance: gross (${grossAmountKobo}) != sum of fees and payout (${feeSum})`,
    );
  }

  return {
    grossAmountKobo,
    paystackFeeKobo,
    platformFeeKobo,
    netPayoutKobo,
  };
}

/**
 * Seeds the commercial catalog with Core/Basic subscription rate card.
 * Idempotent: If "core_basic" already exists, returns existing plan.
 */
export const seedCommercialCatalog = internalMutation({
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
export const recordSettlementTransaction = internalMutation({
  args: {
    schoolId: v.id("schools"),
    transactionRef: v.string(),
    routingMode: v.union(v.literal("mode_a_direct"), v.literal("mode_b_split")),
    grossAmountKobo: v.number(),
    paystackFeeKobo: v.optional(v.number()),
    platformFeeKobo: v.optional(v.number()),
    settlementEvidence: v.optional(
      v.object({
        providerSettlementReference: v.string(),
        providerClearingCycle: v.string(),
        estimatedSettlementDate: v.optional(v.number()),
        settlementNotice: v.optional(v.string()),
      }),
    ),
    destinationAccount: v.optional(v.string()),
    metadata: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
    actorPersonId: v.optional(v.id("persons")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Prevent duplicate references for the same school
    const existing = await ctx.db
      .query("settlementLedgers")
      .withIndex("by_school_and_ref", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("transactionRef", args.transactionRef),
      )
      .first();

    if (existing) {
      throw new ConvexError(
        `Settlement transaction with reference '${args.transactionRef}' has already been recorded.`,
      );
    }

    // Calculate settlement breakdown
    const breakdown = calculateSettlementBreakdown({
      grossAmountKobo: args.grossAmountKobo,
      routingMode: args.routingMode,
      customPaystackFeeKobo: args.paystackFeeKobo,
      customPlatformFeeKobo: args.platformFeeKobo,
    });

    const settlementEvidence = args.settlementEvidence;
    const ledgerId = await ctx.db.insert("settlementLedgers", {
      schoolId: args.schoolId,
      transactionRef: args.transactionRef,
      routingMode: args.routingMode,
      grossAmountKobo: breakdown.grossAmountKobo,
      paystackFeeKobo: breakdown.paystackFeeKobo,
      platformFeeKobo: breakdown.platformFeeKobo,
      netPayoutKobo: breakdown.netPayoutKobo,
      currency: "NGN",
      clearingCycle: settlementEvidence ? "provider_reported" : "unavailable",
      estimatedSettlementDate: settlementEvidence?.estimatedSettlementDate,
      settlementNotice: settlementEvidence?.settlementNotice,
      providerSettlementReference:
        settlementEvidence?.providerSettlementReference,
      providerClearingCycle: settlementEvidence?.providerClearingCycle,
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
      ).toLocaleString()} (Clearing: ${settlementEvidence ? "provider reported" : "unavailable"})`,
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
      v.union(v.literal("mode_a_direct"), v.literal("mode_b_split")),
    ),
    status: v.optional(
      v.union(
        v.literal("pending_clearing"),
        v.literal("settled"),
        v.literal("held_dispute"),
        v.literal("failed"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "finance.settlements.view");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    let queryBuilder = ctx.db
      .query("settlementLedgers")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId));

    if (args.status) {
      queryBuilder = ctx.db
        .query("settlementLedgers")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", args.schoolId).eq("status", args.status!),
        );
    }

    const records = await queryBuilder.order("desc").take(limit * 2);

    const filtered = records.filter((r) => {
      if (args.routingMode && r.routingMode !== args.routingMode) return false;
      return true;
    });

    return await Promise.all(
      filtered.slice(0, limit).map(async (record) => ({
        ...record,
        legs: await ctx.db
          .query("settlementLegs")
          .withIndex("by_settlementId", (q) => q.eq("settlementId", record._id))
          .take(100),
      })),
    );
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
    await requireCapability(ctx, args.schoolId, "finance.settlements.view");
    return await ctx.db
      .query("settlementLedgers")
      .withIndex("by_school_and_ref", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("transactionRef", args.transactionRef),
      )
      .first();
  },
});

/**
 * Creates or updates a school's institutional subscription.
 * Calculates termly platform fee based on active student count + setup fee status.
 */
export const createOrUpdateSchoolSubscription = internalMutation({
  args: {
    schoolId: v.id("schools"),
    planCode: v.optional(v.string()),
    activeStudentCount: v.number(),
    setupFeePaid: v.optional(v.boolean()),
    paymentRoutingMode: v.union(
      v.literal("mode_a_direct"),
      v.literal("mode_b_split"),
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
    await requireCapability(ctx, args.schoolId, "finance.reports.view");
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
    const plans = await ctx.db.query("subscriptionPlans").take(100);
    return plans.filter((plan) => plan.status === "active");
  },
});

async function platformWrite(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  confirmation: string,
) {
  if (!(await isGroupPlatformOperator(ctx)))
    throw new ConvexError("Forbidden: active Platform authority required");
  const school = await ctx.db.get(schoolId);
  if (!school || school.status !== "active")
    throw new ConvexError("Active school required");
  if (confirmation !== "CONFIRM")
    throw new ConvexError("Type CONFIRM after reviewing the financial record");
}
async function commercialAudit(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  action: string,
  targetId: string,
) {
  await recordAuditEventHelper(ctx, {
    schoolId,
    actorKind: "platform_admin",
    actorEmailSnapshot:
      (await ctx.auth.getUserIdentity())?.email ?? "Platform operator",
    module: "commercial",
    action,
    targetType: "commercial_record",
    targetId,
    outcome: "success",
    safeSummary: action,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
}
function period(start: number, end: number) {
  minor(start);
  minor(end);
  if (start >= end || start % 86400000 || end % 86400000)
    throw new ConvexError(
      "Use an increasing UTC-midnight period, end exclusive",
    );
}

export const publishRateVersion = mutation({
  args: {
    journalSchoolId: v.id("schools"),
    confirmation: v.string(),
    code: v.string(),
    name: v.string(),
    expectedVersion: v.number(),
    effectiveFrom: v.number(),
    rate: commercialRate,
  },
  handler: async (ctx, args) => {
    await platformWrite(ctx, args.journalSchoolId, args.confirmation);
    validateRate(args.rate);
    minor(args.expectedVersion);
    minor(args.effectiveFrom);
    if (
      !/^[a-z][a-z0-9_]{2,39}$/.test(args.code) ||
      !args.name.trim() ||
      args.name.length > 100
    )
      throw new ConvexError("Invalid catalog code/name");
    const latest = await ctx.db
      .query("commercialRateVersions")
      .withIndex("by_code_and_version", (q) => q.eq("code", args.code))
      .order("desc")
      .first();
    if ((latest?.version ?? 0) !== args.expectedVersion)
      throw new ConvexError("Catalog version conflict: reload");
    if (
      latest &&
      (args.effectiveFrom <= latest.effectiveFrom ||
        args.effectiveFrom < Date.now())
    )
      throw new ConvexError(
        "A new version must take effect in the future after its predecessor",
      );
    const id = await ctx.db.insert("commercialRateVersions", {
      code: args.code,
      name: args.name.trim(),
      version: args.expectedVersion + 1,
      effectiveFrom: args.effectiveFrom,
      rate: args.rate,
      createdAt: Date.now(),
    });
    await commercialAudit(
      ctx,
      args.journalSchoolId,
      "catalog.version_published",
      id,
    );
    return id;
  },
});

async function billableRoster(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
) {
  const students = await ctx.db
    .query("students")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(501);
  if (students.length > 500) return null;
  const seen = new Set<Id<"users">>();
  const included: Id<"students">[] = [];
  for (const student of students) {
    const user = await ctx.db.get(student.userId);
    const classroom = await ctx.db.get(student.classId);
    if (
      classroom?.schoolId === schoolId &&
      !classroom.isArchived &&
      user?.schoolId === schoolId &&
      isBillableStudent(student, user) &&
      !seen.has(student.userId)
    ) {
      seen.add(student.userId);
      included.push(student._id);
    }
  }
  return { included, excludedCount: students.length - included.length };
}

export const getCommercialWorkspace = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const platform = await isGroupPlatformOperator(ctx);
    if (!platform)
      await requireCapability(ctx, schoolId, "finance.reports.view");
    const [rates, contracts, invoices, legacy] = await Promise.all([
      ctx.db.query("commercialRateVersions").order("desc").take(101),
      ctx.db
        .query("commercialContracts")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .order("desc")
        .take(101),
      ctx.db
        .query("subscriptionInvoices")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .order("desc")
        .take(101),
      ctx.db
        .query("schoolSubscriptions")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .first(),
    ]);
    const now = Date.now();
    const mandates = await ctx.db
      .query("paymentMandates")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .take(101);
    const roster = platform ? await billableRoster(ctx, schoolId) : null;
    return {
      mandates: mandates
        .slice(0, 100)
        .map((m) => ({
          id: m._id,
          recordedStatus: m.status,
          consentRecorded: m.consentGiven,
          updatedAt: m.updatedAt,
          activation: "unavailable" as const,
        })),
      rosterPreview: roster
        ? {
            studentCount: roster.included.length,
            excludedCount: roster.excludedCount,
          }
        : null,
      rates: rates.slice(0, 100),
      contracts: contracts.slice(0, 100).map((c) => ({
        ...c,
        state:
          c.effectiveFrom > now
            ? ("future" as const)
            : c.effectiveTo <= now
              ? ("legacy" as const)
              : ("current" as const),
      })),
      invoices: invoices.slice(0, 100),
      legacy: legacy
        ? { status: legacy.status, snapshotAvailable: false }
        : null,
      truncated:
        rates.length > 100 ||
        contracts.length > 100 ||
        invoices.length > 100 ||
        mandates.length > 100,
      gates: COMMERCIAL_GATES,
      canWrite: platform,
    };
  },
});

export const createContract = mutation({
  args: {
    schoolId: v.id("schools"),
    confirmation: v.string(),
    rateVersionId: v.id("commercialRateVersions"),
    effectiveFrom: v.number(),
    effectiveTo: v.number(),
    overrideRate: v.optional(commercialRate),
    overrideReason: v.optional(v.string()),
    setupHandling: v.union(
      v.literal("charge_once"),
      v.literal("previously_paid"),
      v.literal("waived"),
    ),
    setupReason: v.string(),
  },
  handler: async (ctx, args) => {
    await platformWrite(ctx, args.schoolId, args.confirmation);
    period(args.effectiveFrom, args.effectiveTo);
    const version = await ctx.db.get(args.rateVersionId);
    if (!version || version.effectiveFrom > args.effectiveFrom)
      throw new ConvexError("Rate is not effective at contract start");
    const effectiveVersion = await ctx.db
      .query("commercialRateVersions")
      .withIndex("by_code_and_effective_from_and_version", (q) =>
        q.eq("code", version.code).lte("effectiveFrom", args.effectiveFrom),
      )
      .order("desc")
      .first();
    if (effectiveVersion?._id !== version._id)
      throw new ConvexError("Select the latest catalog version effective at contract start");
    if (
      args.overrideRate &&
      (!args.overrideReason ||
        args.overrideReason.trim().length < 8 ||
        args.overrideReason.length > 240)
    )
      throw new ConvexError("A bounded override reason is required");
    if (args.setupReason.trim().length < 8 || args.setupReason.length > 240)
      throw new ConvexError("Explain the setup handling (8–240 characters)");
    const rate = args.overrideRate ?? version.rate;
    validateRate(rate);
    const contracts = await ctx.db
      .query("commercialContracts")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(501);
    if (contracts.length > 500)
      throw new ConvexError("Contract history exceeds local review bound");
    if (
      args.setupHandling === "charge_once" &&
      contracts.some(
        (c) =>
          c.effectiveFrom <= args.effectiveFrom &&
          c.setupHandling === "previously_paid",
      )
    )
      throw new ConvexError(
        "Setup was already acknowledged as paid; preserve previously_paid handling",
      );
    if (
      contracts.some(
        (c) =>
          args.effectiveFrom < c.effectiveTo &&
          args.effectiveTo > c.effectiveFrom,
      )
    )
      throw new ConvexError(
        "Contract periods cannot overlap; history is immutable",
      );
    const id = await ctx.db.insert("commercialContracts", {
      schoolId: args.schoolId,
      rateVersionId: version._id,
      code: version.code,
      version: version.version,
      rate,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      overrideReason: args.overrideRate
        ? args.overrideReason?.trim()
        : undefined,
      setupHandling: args.setupHandling,
      setupReason: args.setupReason.trim(),
      createdAt: Date.now(),
    });
    await commercialAudit(
      ctx,
      args.schoolId,
      "subscription.contract_created",
      id,
    );
    return id;
  },
});

export const issueSubscriptionInvoice = mutation({
  args: {
    schoolId: v.id("schools"),
    contractId: v.id("commercialContracts"),
    confirmation: v.string(),
    expectedStudentCount: v.number(),
    expectedTotalMinor: v.number(),
    periodLabel: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    await platformWrite(ctx, args.schoolId, args.confirmation);
    period(args.periodStart, args.periodEnd);
    if (!args.periodLabel.trim() || args.periodLabel.length > 100)
      throw new ConvexError("A cadence period label is required");
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.schoolId !== args.schoolId)
      throw new ConvexError("Contract unavailable");
    const periodDays = (args.periodEnd - args.periodStart) / 86400000;
    if (
      contract.rate.cadence === "annually" &&
      periodDays !== 365 &&
      periodDays !== 366
    )
      throw new ConvexError(
        "Annual-upfront invoices require a 365/366-day reference period",
      );
    const start = Math.max(args.periodStart, contract.effectiveFrom),
      end = Math.min(args.periodEnd, contract.effectiveTo);
    if (
      start >= end ||
      start > Date.now() ||
      end <= Date.now() ||
      contract.effectiveTo <= Date.now()
    )
      throw new ConvexError(
        "Only a currently effective contract can be invoiced; snapshots are taken now, never retrospectively",
      );
    if (
      contract.rate.proration === "none" &&
      (start !== args.periodStart || end !== args.periodEnd)
    )
      throw new ConvexError(
        "No-proration contracts require a full covered period",
      );
    const invoices = await ctx.db
      .query("subscriptionInvoices")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(501);
    if (invoices.length > 500)
      throw new ConvexError("Invoice history exceeds local review bound");
    if (
      invoices.some(
        (i) => args.periodStart < i.periodEnd && args.periodEnd > i.periodStart,
      )
    )
      throw new ConvexError(
        "A subscription invoice already covers this period",
      );
    const roster = await billableRoster(ctx, args.schoolId);
    if (!roster)
      throw new ConvexError(
        "Roster exceeds 500: reviewed batch snapshot required; no partial invoice issued",
      );
    const { included, excludedCount } = roster;
    const numerator =
      contract.rate.proration === "daily" ? (end - start) / 86400000 : 1;
    const denominator =
      contract.rate.proration === "daily"
        ? (args.periodEnd - args.periodStart) / 86400000
        : 1;
    const amounts = priceSnapshot(
      contract.rate,
      included.length,
      numerator,
      denominator,
      contract.setupHandling === "charge_once" &&
        !invoices.some((i) => i.setupMinor > 0),
    );
    if (
      args.expectedStudentCount !== included.length ||
      args.expectedTotalMinor !== amounts.totalMinor
    )
      throw new ConvexError(
        "Invoice preview changed: review count and total before confirming",
      );
    const id = await ctx.db.insert("subscriptionInvoices", {
      schoolId: args.schoolId,
      contractId: contract._id,
      chargeClass: "saas_subscription",
      status: "issued_unpaid",
      periodLabel: args.periodLabel.trim(),
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      rate: contract.rate,
      studentCount: included.length,
      excludedCount,
      snapshotPolicy: "active_unique_user_v1",
      prorationNumerator: numerator,
      prorationDenominator: denominator,
      ...amounts,
      createdAt: Date.now(),
    });
    for (const studentId of included)
      await ctx.db.insert("subscriptionInvoiceStudents", {
        invoiceId: id,
        studentId,
      });
    await commercialAudit(
      ctx,
      args.schoolId,
      "subscription.invoice_issued",
      id,
    );
    return id;
  },
});

// Trusted ingestion seam only; no provider adapter or public correction/charge API.
export const recordSettlementLeg = internalMutation({
  args: {
    schoolId: v.id("schools"),
    settlementId: v.id("settlementLedgers"),
    kind: v.union(
      v.literal("refund"),
      v.literal("dispute"),
      v.literal("adjustment"),
    ),
    amountMinor: v.number(),
    evidenceReference: v.string(),
  },
  handler: async (ctx, args) => {
    const settlement = await ctx.db.get(args.settlementId);
    if (!settlement || settlement.schoolId !== args.schoolId)
      throw new ConvexError("Settlement unavailable");
    if (
      !Number.isSafeInteger(args.amountMinor) ||
      args.amountMinor === 0 ||
      !args.evidenceReference.trim() ||
      args.evidenceReference.length > 160
    )
      throw new ConvexError(
        "Signed integer amount and bounded evidence reference required",
      );
    const legs = await ctx.db
      .query("settlementLegs")
      .withIndex("by_settlementId", (q) =>
        q.eq("settlementId", args.settlementId),
      )
      .take(101);
    const existing = legs.find(
      (leg) => leg.evidenceReference === args.evidenceReference,
    );
    if (existing) {
      if (
        existing.kind !== args.kind ||
        existing.amountMinor !== args.amountMinor
      )
        throw new ConvexError("Conflicting settlement evidence");
      return existing._id;
    }
    if (legs.length >= 100)
      throw new ConvexError(
        "Settlement leg bound exceeded; reconciliation review required",
      );
    const id = await ctx.db.insert("settlementLegs", {
      ...args,
      createdAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "commercial-ingestion",
      module: "commercial",
      action: "settlement.leg_recorded",
      targetType: "settlement_leg",
      targetId: id,
      outcome: "success",
      safeSummary: `Recorded ${args.kind} leg; original payout remains unchanged`,
      retentionClass: "permanent_statutory",
    });
    return id;
  },
});
