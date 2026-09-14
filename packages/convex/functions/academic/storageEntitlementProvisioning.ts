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
import { collectStorageClaims } from "./assetStorageBoundary";

const DAY = 86_400_000;
const FREE_TRIAL_RATE_CODE = "free_trial";
const FREE_TRIAL_ENTITLEMENT_CODE = "free_trial_storage";
const FREE_TRIAL_CATALOG_VERSION = 2;
export const FREE_TRIAL_DURATION_DAYS = 365;
export const FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL = 100 * 1024 * 1024;
export const FREE_TRIAL_STORAGE_POOL_BYTES = 750 * 1024 * 1024;
const REVIEWED_EXISTING_SCHOOL_LIMIT = 5;
const FINGERPRINT_BACKFILL_COMPLETE = "backfill:complete:v1";
const STORAGE_RECONCILIATION_ROW_LIMIT = 100;
const STORAGE_RECONCILIATION_OBJECT_LIMIT = 50;
export const STORAGE_RECONCILIATION_CONFIRMATION = "RECONCILE EXISTING STORAGE";

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
      .query("admissionsDocumentUploadIntents")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("storageId"), undefined))
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
      .query("knowledgeOcrJobs")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .first(),
    ctx.db
      .query("demoSeedRuns")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
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
    ctx.db
      .query("importWorkspaces")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .filter((q) => q.neq(q.field("sourceFiles"), []))
      .first(),
  ]);
  return storageOwners.some((owner) => owner !== null);
}

type ReconciledStorageBucket = "active" | "trash" | "temp";

type StorageReconciliationObject = {
  storageId: Id<"_storage">;
  bucket: ReconciledStorageBucket;
  size: number;
};

export type StorageReconciliationSummary = {
  status: "not_needed" | "ready" | "blocked";
  objectCount: number;
  referenceCount: number;
  activeBytes: number;
  trashBytes: number;
  tempBytes: number;
  missingObjectCount: number;
  conflictingObjectCount: number;
  unsupportedReferenceCount: number;
  blockers: string[];
};

type StorageReconciliationInventory = StorageReconciliationSummary & {
  objects: StorageReconciliationObject[];
};

function storageBucketRank(bucket: ReconciledStorageBucket): number {
  return bucket === "active" ? 3 : bucket === "trash" ? 2 : 1;
}

export async function inspectSchoolStorageForReconciliation(
  ctx: MutationCtx | QueryCtx,
  schoolId: Id<"schools">,
): Promise<StorageReconciliationInventory> {
  const school = await ctx.db.get(schoolId);
  if (!school) throw new ConvexError("School not found");

  const [admissions, admissionsIntents, siteAssets, students, materials, knowledgeIntents, ocrJobs, assets, assetIntents, compressionCandidates, cleanup, reports, demoRuns, imports] = await Promise.all([
    ctx.db.query("admissionsDocuments").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("admissionsDocumentUploadIntents").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("schoolSiteAssets").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).filter((q) => q.neq(q.field("photoStorageId"), undefined)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("knowledgeMaterials").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).filter((q) => q.neq(q.field("storageId"), undefined)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("knowledgeMaterialUploadIntents").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).filter((q) => q.neq(q.field("storageId"), undefined)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("knowledgeOcrJobs").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("schoolAssets").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("assetUploadIntents").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).filter((q) => q.neq(q.field("storageId"), undefined)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("pdfCompressionCandidates").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("demoSeedStorageCleanup").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("issuedReportCards").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
    ctx.db.query("importWorkspaces").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).take(STORAGE_RECONCILIATION_ROW_LIMIT + 1),
  ]);
  const boundedRows = [admissions, admissionsIntents, siteAssets, students, materials, knowledgeIntents, ocrJobs, assets, assetIntents, compressionCandidates, cleanup, reports, demoRuns, imports];
  const blockers: string[] = [];
  if (boundedRows.some((rows) => rows.length > STORAGE_RECONCILIATION_ROW_LIMIT)) {
    blockers.push("Storage history is too large for the reviewed reconciliation workflow.");
  }

  const candidatesById = new Map<string, { storageId: Id<"_storage">; bucket: ReconciledStorageBucket; sources: Set<string> }>();
  let referenceCount = 0;
  const add = (storageId: Id<"_storage"> | undefined, bucket: ReconciledStorageBucket, source: string) => {
    if (!storageId) return;
    referenceCount += 1;
    const key = String(storageId);
    const existing = candidatesById.get(key);
    if (!existing) {
      candidatesById.set(key, { storageId, bucket, sources: new Set([source]) });
    } else {
      existing.sources.add(source);
      if (storageBucketRank(bucket) > storageBucketRank(existing.bucket)) existing.bucket = bucket;
    }
  };

  add(school.logoStorageId, "active", "school_logo");
  for (const row of admissions.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, ["deleted", "superseded", "archived"].includes(row.state) ? "trash" : "active", "admissions_document");
  for (const row of admissionsIntents.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "temp", "admissions_upload_intent");
  for (const row of siteAssets.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "active", "site_asset");
  for (const row of students.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.photoStorageId, "active", "student_photo");
  for (const row of materials.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "active", "knowledge_material");
  for (const row of knowledgeIntents.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "temp", "knowledge_upload_intent");
  for (const row of ocrJobs.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "active", "knowledge_ocr_reference");
  for (const row of assets.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) {
    add(row.storageId, row.isTrashed ? "trash" : "active", "school_asset");
    add(row.rollbackStorageId, "temp", "school_asset_rollback");
  }
  for (const row of assetIntents.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "temp", "asset_upload_intent");
  for (const row of compressionCandidates.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.candidateStorageId, "temp", "pdf_candidate");
  for (const row of cleanup.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) add(row.storageId, "temp", "seed_cleanup");
  for (const row of reports.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) {
    add(row.schoolLogoStorageId, "active", "issued_report_logo");
    add(row.studentPhotoStorageId, "active", "issued_report_photo");
  }
  for (const row of demoRuns.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) {
    const bucket = row.status === "succeeded" ? "active" : "temp";
    add(row.logoStorageId, bucket, row.status === "succeeded" ? "demo_seed_reference" : "demo_seed_incomplete");
    for (const storageId of row.portraitStorageIds) add(storageId, bucket, row.status === "succeeded" ? "demo_seed_reference" : "demo_seed_incomplete");
  }
  let unsupportedReferenceCount = 0;
  for (const workspace of imports.slice(0, STORAGE_RECONCILIATION_ROW_LIMIT)) {
    for (const source of workspace.sourceFiles ?? []) {
      add(source.storageId, "active", "import_source");
      unsupportedReferenceCount += 1;
    }
  }
  if (unsupportedReferenceCount) {
    blockers.push("Migration source files require a separate retention review before storage reconciliation.");
  }
  if (candidatesById.size > STORAGE_RECONCILIATION_OBJECT_LIMIT) {
    blockers.push("Storage history contains too many objects for one reviewed reconciliation.");
  }

  const candidates = [...candidatesById.values()].slice(0, STORAGE_RECONCILIATION_OBJECT_LIMIT);
  const inspected = await Promise.all(candidates.map(async (candidate) => {
    const [metadata, claims] = await Promise.all([
      ctx.db.system.get("_storage", candidate.storageId),
      collectStorageClaims(ctx, candidate.storageId),
    ]);
    const crossSchool = claims.some((claim) => claim.schoolId !== schoolId);
    const primaryClaims = claims.filter((claim) => !["admissionsDocumentUploadIntent", "knowledgeMaterialUploadIntent", "knowledgeOcrJobReference", "assetUploadIntent", "demoSeedRunLogoReference", "demoSeedRunPortraitReference", "issuedReportLogoReference", "issuedReportPhotoReference"].includes(claim.purpose));
    const conflicting = crossSchool || new Set(primaryClaims.map((claim) => `${claim.purpose}:${claim.ownerId}`)).size > 1;
    const unresolvedUploadIntent = claims.some((claim) => {
      if (!["admissionsDocumentUploadIntent", "knowledgeMaterialUploadIntent", "assetUploadIntent"].includes(claim.purpose)) return false;
      return !claim.linkedOwnerId || !claims.some((owner) => owner.ownerId === claim.linkedOwnerId);
    });
    const historicalReferenceWithoutOwner = primaryClaims.length === 0 && claims.some((claim) => ["knowledgeOcrJobReference", "demoSeedRunLogoReference", "demoSeedRunPortraitReference", "issuedReportLogoReference", "issuedReportPhotoReference"].includes(claim.purpose));
    const unresolvedTemporary = unresolvedUploadIntent || historicalReferenceWithoutOwner || candidate.sources.has("pdf_candidate") || candidate.sources.has("seed_cleanup") || candidate.sources.has("demo_seed_incomplete");
    return { candidate, metadata, conflicting, unresolvedTemporary };
  }));
  const missingObjectCount = inspected.filter((item) => !item.metadata).length;
  const conflictingObjectCount = inspected.filter((item) => item.conflicting).length;
  const temporaryObjectCount = inspected.filter((item) => item.unresolvedTemporary).length;
  if (missingObjectCount) blockers.push("One or more referenced storage objects are missing.");
  if (conflictingObjectCount) blockers.push("One or more storage objects have conflicting ownership.");
  if (temporaryObjectCount) blockers.push("In-progress or cleanup storage objects must settle before reconciliation.");

  const objects = inspected.flatMap((item) => item.metadata && !item.conflicting ? [{ storageId: item.candidate.storageId, bucket: item.candidate.bucket, size: item.metadata.size }] : []);
  const activeBytes = objects.filter((item) => item.bucket === "active").reduce((sum, item) => sum + item.size, 0);
  const trashBytes = objects.filter((item) => item.bucket === "trash").reduce((sum, item) => sum + item.size, 0);
  const tempBytes = objects.filter((item) => item.bucket === "temp").reduce((sum, item) => sum + item.size, 0);
  if (activeBytes + trashBytes + tempBytes > FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL) {
    blockers.push("Existing storage exceeds the reviewed free-trial allowance.");
  }

  return {
    status: candidatesById.size === 0 ? "not_needed" : blockers.length ? "blocked" : "ready",
    objectCount: candidatesById.size,
    referenceCount,
    activeBytes,
    trashBytes,
    tempBytes,
    missingObjectCount,
    conflictingObjectCount,
    unsupportedReferenceCount,
    blockers: [...new Set(blockers)],
    objects,
  };
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
    auditAction?: "usage.free_trial_storage_provisioned" | "usage.free_trial_storage_reconciled";
    reviewedExistingStorage?: {
      activeBytes: number;
      trashBytes: number;
      tempBytes: number;
    };
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
  if (!school || (school.status ?? "active") !== "active") {
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
  const hasExistingStorageClaims = await schoolHasExistingStorageClaims(ctx, school);
  if (hasExistingStorageClaims && !args.reviewedExistingStorage) {
    return { status: "requires_review" };
  }
  const reviewedExistingStorage = args.reviewedExistingStorage ?? {
    activeBytes: 0,
    trashBytes: 0,
    tempBytes: 0,
  };
  const reviewedConsumedUnits = reviewedExistingStorage.activeBytes + reviewedExistingStorage.trashBytes + reviewedExistingStorage.tempBytes;
  if (
    !isSafeNonnegativeInteger(reviewedExistingStorage.activeBytes) ||
    !isSafeNonnegativeInteger(reviewedExistingStorage.trashBytes) ||
    !isSafeNonnegativeInteger(reviewedExistingStorage.tempBytes) ||
    reviewedConsumedUnits > FREE_TRIAL_STORAGE_BYTES_PER_SCHOOL
  ) {
    throw new ConvexError("Reviewed existing storage baseline is invalid");
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
    consumedUnits: reviewedConsumedUnits,
    activeStorageBytes: reviewedExistingStorage.activeBytes,
    trashStorageBytes: reviewedExistingStorage.trashBytes,
    tempStorageBytes: reviewedExistingStorage.tempBytes,
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
    action: args.auditAction ?? "usage.free_trial_storage_provisioned",
    targetType: "usage_cycle",
    targetId: cycleId,
    outcome: "success",
    safeSummary: args.auditSummary,
    retentionClass: "permanent_statutory",
    alertTier: "tier2_warn",
  });
  return { status: "created", cycleId };
}

export async function reconcileSchoolFreeTrialStorageHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorEmail: string;
    confirmation: string;
    expectedObjectCount: number;
    expectedReferenceCount: number;
    expectedActiveBytes: number;
    expectedTrashBytes: number;
    expectedTempBytes: number;
  },
): Promise<{ status: ProvisioningStatus; summary: StorageReconciliationSummary }> {
  if (args.confirmation !== STORAGE_RECONCILIATION_CONFIRMATION) {
    throw new ConvexError(`Type ${STORAGE_RECONCILIATION_CONFIRMATION} after reviewing the storage inventory`);
  }
  const inventory = await inspectSchoolStorageForReconciliation(ctx, args.schoolId);
  const summary: StorageReconciliationSummary = {
    status: inventory.status,
    objectCount: inventory.objectCount,
    referenceCount: inventory.referenceCount,
    activeBytes: inventory.activeBytes,
    trashBytes: inventory.trashBytes,
    tempBytes: inventory.tempBytes,
    missingObjectCount: inventory.missingObjectCount,
    conflictingObjectCount: inventory.conflictingObjectCount,
    unsupportedReferenceCount: inventory.unsupportedReferenceCount,
    blockers: inventory.blockers,
  };
  if (inventory.status !== "ready") return { status: "requires_review", summary };
  if (
    inventory.objectCount !== args.expectedObjectCount ||
    inventory.referenceCount !== args.expectedReferenceCount ||
    inventory.activeBytes !== args.expectedActiveBytes ||
    inventory.trashBytes !== args.expectedTrashBytes ||
    inventory.tempBytes !== args.expectedTempBytes
  ) {
    throw new ConvexError("Storage inventory changed. Review the latest totals before confirming again");
  }

  const actorEmail = args.actorEmail.trim().toLowerCase();
  if (!actorEmail || actorEmail.length > 240) throw new ConvexError("A bounded Platform operator email is required");
  const startAt = utcMidnight(Date.now());
  const result = await provisionSchoolStorage(ctx, {
    schoolId: args.schoolId,
    startAt,
    endAt: startAt + FREE_TRIAL_DURATION_DAYS * DAY,
    actorKind: "platform_admin",
    actorEmail,
    auditAction: "usage.free_trial_storage_reconciled",
    auditSummary: `Reconciled ${inventory.objectCount} existing storage objects totaling ${inventory.activeBytes + inventory.trashBytes + inventory.tempBytes} bytes into the reviewed free-trial storage entitlement; no files were changed or deleted`,
    reviewedExistingStorage: {
      activeBytes: inventory.activeBytes,
      trashBytes: inventory.trashBytes,
      tempBytes: inventory.tempBytes,
    },
  });
  if (result.status !== "created") return { status: result.status, summary };

  const assets = await ctx.db
    .query("schoolAssets")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .take(STORAGE_RECONCILIATION_ROW_LIMIT + 1);
  if (assets.length > STORAGE_RECONCILIATION_ROW_LIMIT) {
    throw new ConvexError("Storage inventory changed during reconciliation");
  }
  const now = Date.now();
  for (const asset of assets) {
    const metadata = await ctx.db.system.get("_storage", asset.storageId);
    if (!metadata) throw new ConvexError("Storage inventory changed during reconciliation");
    await ctx.db.patch(asset._id, {
      byteSize: metadata.size,
      mimeType: metadata.contentType ?? asset.mimeType,
      sha256: metadata.sha256,
      storageAccountingInitializedAt: now,
      storageReconciliationState: undefined,
      updatedAt: now,
    });
  }
  return { status: result.status, summary };
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
