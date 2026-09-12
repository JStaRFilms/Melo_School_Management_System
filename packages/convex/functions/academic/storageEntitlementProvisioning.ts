import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { recordAuditEventHelper } from "./audit";
import { validateEntitlement } from "../foundation/usageContract";
import { validateRate } from "../foundation/commercialContract";

const DAY = 86_400_000;
const FREE_TRIAL_RATE_CODE = "free_trial";
const FREE_TRIAL_ENTITLEMENT_CODE = "free_trial_storage";
const FREE_TRIAL_CATALOG_VERSION = 2;
export const FREE_TRIAL_DURATION_DAYS = 365;
export const FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL = 100 * 1024 * 1024;
export const FREE_TRIAL_STORAGE_POOL_BYTES = 750 * 1024 * 1024;
const REVIEWED_EXISTING_SCHOOL_LIMIT = 5;
const FINGERPRINT_BACKFILL_COMPLETE = "backfill:complete:v1";

type ProvisioningStatus =
  | "created"
  | "already_configured"
  | "pool_exhausted"
  | "requires_review";

function utcMidnight(timestamp: number): number {
  return Math.floor(timestamp / DAY) * DAY;
}

function isSafeNonnegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function freeTrialRate() {
  return {
    currency: "NGN",
    perStudentMinor: 0,
    setupMinor: 0,
    minimumMinor: 0,
    discountBps: 0,
    bands: [],
    cadence: "termly" as const,
    proration: "daily" as const,
  };
}

function freeTrialEntitlement() {
  return {
    allowances: [{
      meterType: "storage_bytes" as const,
      baseUnits: FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL,
      graceUnits: 0,
    }],
    warningPercent: 75,
    criticalPercent: 90,
    hardStopPercent: 100,
    maxFileSizeBytes: 12 * 1024 * 1024,
    maxPagesPerOperation: 80,
    profiles: [{
      task: "knowledge_upload" as const,
      meterType: "storage_bytes" as const,
      unitsPerItem: 1,
      maxItems: 12 * 1024 * 1024,
      modelProfile: "secure-upload",
    }],
  };
}

function isReviewedFreeTrialRate(
  rate: Doc<"commercialRateVersions">["rate"],
): boolean {
  const expected = freeTrialRate();
  return rate.currency === expected.currency &&
    rate.perStudentMinor === expected.perStudentMinor &&
    rate.setupMinor === expected.setupMinor &&
    rate.minimumMinor === expected.minimumMinor &&
    rate.discountBps === expected.discountBps &&
    rate.cadence === expected.cadence &&
    rate.proration === expected.proration &&
    rate.bands.length === 0;
}

function isReviewedFreeTrialEntitlement(
  entitlement: Doc<"usageEntitlementVersions">["entitlement"],
): boolean {
  const expected = freeTrialEntitlement();
  const allowance = entitlement.allowances[0];
  const profile = entitlement.profiles[0];
  return entitlement.allowances.length === 1 &&
    allowance?.meterType === "storage_bytes" &&
    allowance.baseUnits === FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL &&
    allowance.graceUnits === 0 &&
    entitlement.warningPercent === expected.warningPercent &&
    entitlement.criticalPercent === expected.criticalPercent &&
    entitlement.hardStopPercent === expected.hardStopPercent &&
    entitlement.maxFileSizeBytes === expected.maxFileSizeBytes &&
    entitlement.maxPagesPerOperation === expected.maxPagesPerOperation &&
    entitlement.profiles.length === 1 &&
    profile?.task === "knowledge_upload" &&
    profile.meterType === "storage_bytes" &&
    profile.unitsPerItem === 1 &&
    profile.maxItems === 12 * 1024 * 1024 &&
    profile.modelProfile === "secure-upload";
}

async function getOrCreateFreeTrialCatalog(
  ctx: MutationCtx,
  effectiveFrom: number,
): Promise<{
  rateVersionId: Id<"commercialRateVersions">;
  entitlementVersionId: Id<"usageEntitlementVersions">;
}> {
  const [existingRate, existingEntitlement] = await Promise.all([
    ctx.db
      .query("commercialRateVersions")
      .withIndex("by_code_and_version", (q) =>
        q.eq("code", FREE_TRIAL_RATE_CODE).eq("version", FREE_TRIAL_CATALOG_VERSION),
      )
      .unique(),
    ctx.db
      .query("usageEntitlementVersions")
      .withIndex("by_code_and_version", (q) =>
        q.eq("code", FREE_TRIAL_ENTITLEMENT_CODE).eq("version", FREE_TRIAL_CATALOG_VERSION),
      )
      .unique(),
  ]);
  if (Boolean(existingRate) !== Boolean(existingEntitlement)) {
    throw new ConvexError("Free-trial catalog is incomplete and requires reconciliation");
  }
  if (existingRate && existingEntitlement) {
    if (
      !isReviewedFreeTrialRate(existingRate.rate) ||
      !isReviewedFreeTrialEntitlement(existingEntitlement.entitlement)
    ) {
      throw new ConvexError("Free-trial catalog differs from the reviewed storage preset");
    }
    if (
      existingRate.effectiveFrom > effectiveFrom ||
      existingEntitlement.effectiveFrom > effectiveFrom
    ) {
      throw new ConvexError("Free-trial catalog is not effective for the requested storage period");
    }
    return {
      rateVersionId: existingRate._id,
      entitlementVersionId: existingEntitlement._id,
    };
  }

  const rate = freeTrialRate();
  const entitlement = freeTrialEntitlement();
  validateRate(rate);
  validateEntitlement(entitlement);
  const now = Date.now();
  const rateVersionId = await ctx.db.insert("commercialRateVersions", {
    code: FREE_TRIAL_RATE_CODE,
    name: "Free trial",
    version: FREE_TRIAL_CATALOG_VERSION,
    effectiveFrom,
    rate,
    createdAt: now,
  });
  const entitlementVersionId = await ctx.db.insert("usageEntitlementVersions", {
    code: FREE_TRIAL_ENTITLEMENT_CODE,
    name: "Free trial storage",
    version: FREE_TRIAL_CATALOG_VERSION,
    effectiveFrom,
    entitlement,
    createdAt: now,
  });
  return { rateVersionId, entitlementVersionId };
}

export async function schoolHasExistingStorageClaims(
  ctx: MutationCtx | QueryCtx,
  school: Doc<"schools">,
): Promise<boolean> {
  if (school.logoStorageId) return true;

  const storageOwners = await Promise.all([
    ctx.db
      .query("admissionsDocuments")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("schoolSiteAssets")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("photoStorageId"), undefined))
      .first(),
    ctx.db
      .query("knowledgeMaterials")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("storageId"), undefined))
      .first(),
    ctx.db
      .query("knowledgeMaterialUploadIntents")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("storageId"), undefined))
      .first(),
    ctx.db
      .query("schoolAssets")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("assetUploadIntents")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("storageId"), undefined))
      .first(),
    ctx.db
      .query("pdfCompressionCandidates")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("demoSeedStorageCleanup")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("issuedReportCards")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) =>
        q.or(
          q.neq(q.field("schoolLogoStorageId"), undefined),
          q.neq(q.field("studentPhotoStorageId"), undefined),
        ),
      )
      .first(),
  ]);
  return storageOwners.some((owner) => owner !== null);
}

async function provisionSchoolStorage(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    startAt: number;
    endAt: number;
    actorKind: "platform_admin" | "system";
    actorEmail: string;
    auditSummary: string;
  },
): Promise<{ status: ProvisioningStatus; cycleId?: Id<"usageCycles"> }> {
  const [school, contracts, cycles, storageMeters] = await Promise.all([
    ctx.db.get(args.schoolId),
    ctx.db.query("commercialContracts").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(2),
    ctx.db.query("usageCycles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(2),
    ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) =>
        q.eq("schoolId", args.schoolId).eq("meterType", "storage_bytes"),
      )
      .take(2),
  ]);
  if (!school || school.status !== "active") {
    throw new ConvexError("An active school is required for storage provisioning");
  }
  if (storageMeters.length > 1) {
    throw new ConvexError("Duplicate storage meters require reconciliation");
  }
  if (storageMeters[0]) {
    const meter = storageMeters[0];
    const cycle = meter.cycleId ? await ctx.db.get(meter.cycleId) : null;
    const contract = cycle?.contractId ? await ctx.db.get(cycle.contractId) : null;
    const rateVersion = contract?.rateVersionId
      ? await ctx.db.get(contract.rateVersionId)
      : null;
    const entitlementVersion = cycle?.entitlementVersionId
      ? await ctx.db.get(cycle.entitlementVersionId)
      : null;
    const activeStorageBytes = meter.activeStorageBytes ?? 0;
    const trashStorageBytes = meter.trashStorageBytes ?? 0;
    const tempStorageBytes = meter.tempStorageBytes ?? 0;
    const now = Date.now();
    const isValidExistingStorage =
      contracts.length === 1 &&
      cycles.length === 1 &&
      cycle !== null &&
      contract !== null &&
      cycle._id === cycles[0]?._id &&
      cycle.schoolId === args.schoolId &&
      cycle.status === "active" &&
      cycle.startAt <= now &&
      now < cycle.endAt &&
      contract._id === contracts[0]?._id &&
      contract.schoolId === args.schoolId &&
      contract._id === cycle.contractId &&
      contract.code === FREE_TRIAL_RATE_CODE &&
      contract.version === FREE_TRIAL_CATALOG_VERSION &&
      contract.effectiveFrom === cycle.startAt &&
      contract.effectiveTo === cycle.endAt &&
      contract.effectiveFrom <= now &&
      now < contract.effectiveTo &&
      contract.setupHandling === "waived" &&
      isReviewedFreeTrialRate(contract.rate) &&
      rateVersion !== null &&
      rateVersion.code === FREE_TRIAL_RATE_CODE &&
      rateVersion.version === FREE_TRIAL_CATALOG_VERSION &&
      rateVersion.effectiveFrom <= contract.effectiveFrom &&
      isReviewedFreeTrialRate(rateVersion.rate) &&
      cycle.code === FREE_TRIAL_ENTITLEMENT_CODE &&
      cycle.version === FREE_TRIAL_CATALOG_VERSION &&
      isReviewedFreeTrialEntitlement(cycle.entitlement) &&
      entitlementVersion !== null &&
      entitlementVersion.code === FREE_TRIAL_ENTITLEMENT_CODE &&
      entitlementVersion.version === FREE_TRIAL_CATALOG_VERSION &&
      entitlementVersion.effectiveFrom <= cycle.startAt &&
      isReviewedFreeTrialEntitlement(entitlementVersion.entitlement) &&
      meter.allocatedUnits === FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL &&
      meter.baseUnits === FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL &&
      meter.graceUnits === 0 &&
      meter.topUpUnits === 0 &&
      meter.exceptionUnits === 0 &&
      meter.poolUnits === 0 &&
      isSafeNonnegativeInteger(meter.consumedUnits) &&
      isSafeNonnegativeInteger(meter.reservedUnits) &&
      meter.consumedUnits + meter.reservedUnits <= meter.allocatedUnits &&
      isSafeNonnegativeInteger(activeStorageBytes) &&
      isSafeNonnegativeInteger(trashStorageBytes) &&
      isSafeNonnegativeInteger(tempStorageBytes) &&
      activeStorageBytes + trashStorageBytes + tempStorageBytes === meter.consumedUnits &&
      meter.warningThresholdPercent === 75 &&
      meter.criticalThresholdPercent === 90 &&
      meter.hardStopThresholdPercent === 100 &&
      meter.resetCadence === "termly";
    return { status: isValidExistingStorage ? "already_configured" : "requires_review" };
  }
  if (contracts.length || cycles.length) return { status: "requires_review" };
  if (await schoolHasExistingStorageClaims(ctx, school)) {
    return { status: "requires_review" };
  }

  const allocationRows = await ctx.db.query("usageMeterAllocations").take(1001);
  if (allocationRows.length > 1000) {
    throw new ConvexError("Storage allocation inventory exceeds the review bound");
  }
  const allocatedStorageBytes = allocationRows
    .filter((row) => row.meterType === "storage_bytes")
    .reduce((sum, row) => sum + row.allocatedUnits, 0);
  if (
    !Number.isSafeInteger(allocatedStorageBytes) ||
    allocatedStorageBytes + FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL > FREE_TRIAL_STORAGE_POOL_BYTES
  ) {
    return { status: "pool_exhausted" };
  }

  const { rateVersionId, entitlementVersionId } = await getOrCreateFreeTrialCatalog(
    ctx,
    args.startAt,
  );
  const rate = freeTrialRate();
  const entitlement = freeTrialEntitlement();
  const now = Date.now();
  const contractId = await ctx.db.insert("commercialContracts", {
    schoolId: args.schoolId,
    rateVersionId,
    code: FREE_TRIAL_RATE_CODE,
    version: FREE_TRIAL_CATALOG_VERSION,
    rate,
    effectiveFrom: args.startAt,
    effectiveTo: args.endAt,
    setupHandling: "waived",
    setupReason: "Reviewed free-trial onboarding; no charge or payment inferred",
    createdAt: now,
  });
  const cycleId = await ctx.db.insert("usageCycles", {
    schoolId: args.schoolId,
    contractId,
    entitlementVersionId,
    code: FREE_TRIAL_ENTITLEMENT_CODE,
    version: FREE_TRIAL_CATALOG_VERSION,
    entitlement,
    startAt: args.startAt,
    endAt: args.endAt,
    status: "active",
    createdAt: now,
  });
  await ctx.db.insert("usageMeterAllocations", {
    schoolId: args.schoolId,
    cycleId,
    meterType: "storage_bytes",
    allocatedUnits: FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL,
    baseUnits: FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL,
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
  const existingKnowledgeMaterial = await ctx.db
    .query("knowledgeMaterials")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .first();
  if (!existingKnowledgeMaterial) {
    const completionMarkers = await ctx.db
      .query("knowledgeMaterialFileFingerprints")
      .withIndex("by_school_and_sha256", (q) =>
        q.eq("schoolId", args.schoolId).eq("sha256", FINGERPRINT_BACKFILL_COMPLETE),
      )
      .take(2);
    if (completionMarkers.length > 1) {
      throw new ConvexError("Fingerprint backfill markers require reconciliation");
    }
    if (!completionMarkers[0]) {
      await ctx.db.insert("knowledgeMaterialFileFingerprints", {
        schoolId: args.schoolId,
        sha256: FINGERPRINT_BACKFILL_COMPLETE,
        status: "backfill_complete",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  await recordAuditEventHelper(ctx, {
    schoolId: args.schoolId,
    actorKind: args.actorKind,
    actorEmailSnapshot: args.actorEmail,
    module: "commercial",
    action: "usage.free_trial_storage_provisioned",
    targetType: "usage_cycle",
    targetId: cycleId,
    outcome: "success",
    safeSummary: args.auditSummary,
    retentionClass: "permanent_statutory",
    alertTier: "tier2_warn",
  });
  return { status: "created", cycleId };
}

export async function ensureSchoolFreeTrialStorageHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorEmail: string;
    auditSummary?: string;
  },
): Promise<{ status: ProvisioningStatus; cycleId?: Id<"usageCycles"> }> {
  const actorEmail = args.actorEmail.trim().toLowerCase();
  if (!actorEmail || actorEmail.length > 240) {
    throw new ConvexError("A bounded Platform operator email is required");
  }
  const startAt = utcMidnight(Date.now());
  return await provisionSchoolStorage(ctx, {
    schoolId: args.schoolId,
    startAt,
    endAt: startAt + FREE_TRIAL_DURATION_DAYS * DAY,
    actorKind: "platform_admin",
    actorEmail,
    auditSummary:
      args.auditSummary ??
      `Activated the reviewed ${FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL}-byte free-trial storage entitlement during school provisioning; no invoice or payment created`,
  });
}

export const ensureSchoolFreeTrialStorage = internalMutation({
  args: {
    schoolId: v.id("schools"),
    actorEmail: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("created"),
      v.literal("already_configured"),
      v.literal("pool_exhausted"),
      v.literal("requires_review"),
    ),
    cycleId: v.optional(v.id("usageCycles")),
  }),
  handler: ensureSchoolFreeTrialStorageHelper,
});

export const provisionReviewedFreeTrialStorage = internalMutation({
  args: {
    schoolIds: v.array(v.id("schools")),
    bytesPerSchool: v.number(),
    startAt: v.number(),
    endAt: v.number(),
    actorEmail: v.string(),
    confirmation: v.string(),
  },
  returns: v.object({
    schoolCount: v.number(),
    bytesPerSchool: v.number(),
    totalEntitledBytes: v.number(),
  }),
  handler: async (ctx, args) => {
    const actorEmail = args.actorEmail.trim().toLowerCase();
    if (!actorEmail || actorEmail.length > 240) {
      throw new ConvexError("A bounded Platform operator email is required");
    }
    if (args.confirmation !== "PROVISION FREE TRIAL STORAGE") {
      throw new ConvexError("Type PROVISION FREE TRIAL STORAGE after reviewing every target school");
    }
    if (
      args.schoolIds.length < 1 ||
      args.schoolIds.length > REVIEWED_EXISTING_SCHOOL_LIMIT ||
      new Set(args.schoolIds.map(String)).size !== args.schoolIds.length
    ) {
      throw new ConvexError(`Provide 1–${REVIEWED_EXISTING_SCHOOL_LIMIT} unique reviewed school IDs`);
    }
    if (
      args.bytesPerSchool !== FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL ||
      !Number.isSafeInteger(args.startAt) ||
      !Number.isSafeInteger(args.endAt) ||
      args.startAt % DAY !== 0 ||
      args.endAt % DAY !== 0 ||
      args.startAt >= args.endAt
    ) {
      throw new ConvexError("Use the reviewed 100 MiB allowance and an increasing UTC-midnight period");
    }
    if (args.bytesPerSchool * args.schoolIds.length > FREE_TRIAL_STORAGE_POOL_BYTES) {
      throw new ConvexError("Reviewed storage provisioning exceeds the free-tier safety pool");
    }

    for (const schoolId of args.schoolIds) {
      const [school, contracts, cycles, storageMeters] = await Promise.all([
        ctx.db.get(schoolId),
        ctx.db.query("commercialContracts").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2),
        ctx.db.query("usageCycles").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(2),
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).take(2),
      ]);
      if (!school || school.status !== "active") {
        throw new ConvexError(`Reviewed school ${schoolId} is not active`);
      }
      if (contracts.length || cycles.length || storageMeters.length) {
        throw new ConvexError(`School ${schoolId} already has commercial or storage history and requires individual review`);
      }
    }

    for (const schoolId of args.schoolIds) {
      const result = await provisionSchoolStorage(ctx, {
        schoolId,
        startAt: args.startAt,
        endAt: args.endAt,
        actorKind: "platform_admin",
        actorEmail,
        auditSummary: `Activated reviewed free-trial contract and ${FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL}-byte storage entitlement; no invoice or payment created`,
      });
      if (result.status !== "created") {
        throw new ConvexError(`School ${schoolId} could not receive the reviewed storage entitlement`);
      }
    }

    return {
      schoolCount: args.schoolIds.length,
      bytesPerSchool: args.bytesPerSchool,
      totalEntitledBytes: args.bytesPerSchool * args.schoolIds.length,
    };
  },
});
