import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { recordAuditEventHelper } from "./audit";
import { validateEntitlement } from "../foundation/usageContract";
import { validateRate } from "../foundation/commercialContract";

const DAY = 86_400_000;
const FREE_TRIAL_RATE_CODE = "free_trial";
const FREE_TRIAL_ENTITLEMENT_CODE = "free_trial_storage";

export const provisionReviewedFreeTrialStorage = internalMutation({
  args: {
    schoolIds: v.array(v.id("schools")),
    bytesPerSchool: v.number(),
    startAt: v.number(),
    endAt: v.number(),
    confirmation: v.string(),
  },
  returns: v.object({
    schoolCount: v.number(),
    bytesPerSchool: v.number(),
    totalEntitledBytes: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.confirmation !== "PROVISION FREE TRIAL STORAGE") {
      throw new ConvexError("Type PROVISION FREE TRIAL STORAGE after reviewing every target school");
    }
    if (
      args.schoolIds.length < 1 ||
      args.schoolIds.length > 10 ||
      new Set(args.schoolIds.map(String)).size !== args.schoolIds.length
    ) {
      throw new ConvexError("Provide 1–10 unique reviewed school IDs");
    }
    if (
      !Number.isSafeInteger(args.bytesPerSchool) ||
      args.bytesPerSchool <= 0 ||
      !Number.isSafeInteger(args.startAt) ||
      !Number.isSafeInteger(args.endAt) ||
      args.startAt % DAY !== 0 ||
      args.endAt % DAY !== 0 ||
      args.startAt >= args.endAt
    ) {
      throw new ConvexError("Use a positive safe byte allowance and an increasing UTC-midnight period");
    }
    if (!Number.isSafeInteger(args.bytesPerSchool * args.schoolIds.length)) {
      throw new ConvexError("Total storage entitlement exceeds the safe integer range");
    }

    const [existingRate, existingEntitlement] = await Promise.all([
      ctx.db
        .query("commercialRateVersions")
        .withIndex("by_code_and_version", (q) => q.eq("code", FREE_TRIAL_RATE_CODE))
        .first(),
      ctx.db
        .query("usageEntitlementVersions")
        .withIndex("by_code_and_version", (q) => q.eq("code", FREE_TRIAL_ENTITLEMENT_CODE))
        .first(),
    ]);
    if (existingRate || existingEntitlement) {
      throw new ConvexError("Free-trial provisioning records already exist; review them instead of replaying the operation");
    }

    for (const schoolId of args.schoolIds) {
      const [school, contracts, cycles, storageMeters] = await Promise.all([
        ctx.db.get(schoolId),
        ctx.db.query("commercialContracts").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2),
        ctx.db.query("usageCycles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2),
        ctx.db
          .query("usageMeterAllocations")
          .withIndex("by_school_and_meter", (q) =>
            q.eq("schoolId", schoolId).eq("meterType", "storage_bytes"),
          )
          .take(2),
      ]);
      if (!school) throw new ConvexError(`Reviewed school ${schoolId} is unavailable`);
      if (contracts.length || cycles.length || storageMeters.length) {
        throw new ConvexError(`School ${schoolId} already has commercial or storage history and requires individual review`);
      }
    }

    const now = Date.now();
    const rate = {
      currency: "NGN",
      perStudentMinor: 0,
      setupMinor: 0,
      minimumMinor: 0,
      discountBps: 0,
      bands: [],
      cadence: "termly" as const,
      proration: "daily" as const,
    };
    validateRate(rate);
    const entitlement = {
      allowances: [{ meterType: "storage_bytes" as const, baseUnits: args.bytesPerSchool, graceUnits: 0 }],
      warningPercent: 75,
      criticalPercent: 90,
      hardStopPercent: 100,
      maxFileSizeBytes: Math.min(12 * 1024 * 1024, args.bytesPerSchool),
      maxPagesPerOperation: 500,
      profiles: [{
        task: "knowledge_upload" as const,
        meterType: "storage_bytes" as const,
        unitsPerItem: 1,
        maxItems: Math.min(12 * 1024 * 1024, args.bytesPerSchool),
        modelProfile: "secure-upload",
      }],
    };
    validateEntitlement(entitlement);

    const rateVersionId = await ctx.db.insert("commercialRateVersions", {
      code: FREE_TRIAL_RATE_CODE,
      name: "Free trial",
      version: 1,
      effectiveFrom: args.startAt,
      rate,
      createdAt: now,
    });
    const entitlementVersionId = await ctx.db.insert("usageEntitlementVersions", {
      code: FREE_TRIAL_ENTITLEMENT_CODE,
      name: "Free trial storage",
      version: 1,
      effectiveFrom: args.startAt,
      entitlement,
      createdAt: now,
    });

    for (const schoolId of args.schoolIds) {
      const contractId = await ctx.db.insert("commercialContracts", {
        schoolId,
        rateVersionId,
        code: FREE_TRIAL_RATE_CODE,
        version: 1,
        rate,
        effectiveFrom: args.startAt,
        effectiveTo: args.endAt,
        setupHandling: "waived",
        setupReason: "Reviewed free-trial onboarding; no charge or payment inferred",
        createdAt: now,
      });
      const cycleId = await ctx.db.insert("usageCycles", {
        schoolId,
        contractId,
        entitlementVersionId,
        code: FREE_TRIAL_ENTITLEMENT_CODE,
        version: 1,
        entitlement,
        startAt: args.startAt,
        endAt: args.endAt,
        status: "active",
        createdAt: now,
      });
      await ctx.db.insert("usageMeterAllocations", {
        schoolId,
        cycleId,
        meterType: "storage_bytes",
        allocatedUnits: args.bytesPerSchool,
        baseUnits: args.bytesPerSchool,
        graceUnits: 0,
        topUpUnits: 0,
        exceptionUnits: 0,
        poolUnits: 0,
        consumedUnits: 0,
        activeStorageBytes: 0,
        trashStorageBytes: 0,
        tempStorageBytes: 0,
        reservedUnits: 0,
        warningThresholdPercent: 75,
        criticalThresholdPercent: 90,
        hardStopThresholdPercent: 100,
        resetCadence: "termly",
        lastResetAt: args.startAt,
        updatedAt: now,
      });
      await recordAuditEventHelper(ctx, {
        schoolId,
        actorKind: "platform_admin",
        actorEmailSnapshot: "authenticated deployment operator",
        module: "commercial",
        action: "usage.free_trial_storage_provisioned",
        targetType: "usage_cycle",
        targetId: cycleId,
        outcome: "success",
        safeSummary: `Activated reviewed free-trial contract and ${args.bytesPerSchool}-byte storage entitlement; no invoice or payment created`,
        retentionClass: "permanent_statutory",
        alertTier: "tier2_warn",
      });
    }

    return {
      schoolCount: args.schoolIds.length,
      bytesPerSchool: args.bytesPerSchool,
      totalEntitledBytes: args.bytesPerSchool * args.schoolIds.length,
    };
  },
});
