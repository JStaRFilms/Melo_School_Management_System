import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

type Context = QueryCtx | MutationCtx;

export const SECURE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Uploads unavailable: the current storage transport cannot prove tenant and caller provenance, reserve purchased quota before transfer, or guarantee abandoned-upload cleanup";

/**
 * Generic Convex upload URLs do not carry an authoritative school/caller/purpose
 * claim and cannot reserve or clean up bytes that never reach finalization.
 */
export function secureUploadUnavailable<T>(): T {
  throw new ConvexError(SECURE_UPLOAD_UNAVAILABLE_MESSAGE);
}

export function assertSecureUploadTransportAvailable(): void {
  secureUploadUnavailable<void>();
}

type StorageClaimPurpose =
  | "admissionsDocument"
  | "schoolSiteAsset"
  | "schoolLogo"
  | "studentPhoto"
  | "knowledgeMaterial"
  | "assetUploadIntent"
  | "schoolAsset"
  | "schoolAssetRollback"
  | "pdfCompressionCandidate"
  | "demoSeedCleanup";

export type ExpectedStorageClaim = {
  purpose: StorageClaimPurpose;
  ownerId: string;
};

type CollectedStorageClaim = ExpectedStorageClaim & {
  linkedOwnerId?: string;
};

/** References such as OCR jobs and immutable report snapshots are not owners. */
async function collectStorageClaims(ctx: Context, storageId: Id<"_storage">): Promise<CollectedStorageClaim[]> {
  const [admissions, siteAssets, schools, students, materials, intents, assets, rollbacks, candidates, cleanup] = await Promise.all([
    ctx.db.query("admissionsDocuments").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolSiteAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schools").withIndex("by_logo_storage", q => q.eq("logoStorageId", storageId)).take(2),
    ctx.db.query("students").withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).take(2),
    ctx.db.query("knowledgeMaterials").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("assetUploadIntents").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_rollback_storage", q => q.eq("rollbackStorageId", storageId)).take(2),
    ctx.db.query("pdfCompressionCandidates").withIndex("by_candidate_storage", q => q.eq("candidateStorageId", storageId)).take(2),
    ctx.db.query("demoSeedStorageCleanup").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
  ]);
  return [
    ...admissions.map(row => ({ purpose: "admissionsDocument" as const, ownerId: String(row._id) })),
    ...siteAssets.map(row => ({ purpose: "schoolSiteAsset" as const, ownerId: String(row._id) })),
    ...schools.map(row => ({ purpose: "schoolLogo" as const, ownerId: String(row._id) })),
    ...students.map(row => ({ purpose: "studentPhoto" as const, ownerId: String(row._id) })),
    ...materials.map(row => ({ purpose: "knowledgeMaterial" as const, ownerId: String(row._id) })),
    ...intents.map(row => ({
      purpose: "assetUploadIntent" as const,
      ownerId: String(row._id),
      ...(row.status === "finalized" && row.assetId ? { linkedOwnerId: String(row.assetId) } : {}),
    })),
    ...assets.map(row => ({ purpose: "schoolAsset" as const, ownerId: String(row._id) })),
    ...rollbacks.map(row => ({ purpose: "schoolAssetRollback" as const, ownerId: String(row._id) })),
    ...candidates.map(row => ({ purpose: "pdfCompressionCandidate" as const, ownerId: String(row._id) })),
    ...cleanup.map(row => ({ purpose: "demoSeedCleanup" as const, ownerId: String(row._id) })),
  ];
}

/** A new claim is allowed only when no owning record exists anywhere. */
export async function assertStorageUnclaimed(ctx: Context, storageId: Id<"_storage">) {
  if ((await collectStorageClaims(ctx, storageId)).length) {
    throw new ConvexError("Storage object is already bound to another owning purpose");
  }
}

/** Destructive operations must prove that no other current or legacy owner exists. */
export async function assertStorageClaimedOnlyBy(
  ctx: Context,
  storageId: Id<"_storage">,
  expected: ExpectedStorageClaim,
) {
  const claims = await collectStorageClaims(ctx, storageId);
  const expectedClaims = claims.filter(
    claim => claim.purpose === expected.purpose && claim.ownerId === expected.ownerId,
  );
  const linkedFinalizedIntents = expected.purpose === "schoolAsset"
    ? claims.filter(claim => claim.purpose === "assetUploadIntent" && claim.linkedOwnerId === expected.ownerId)
    : [];
  if (expectedClaims.length !== 1 || claims.length !== expectedClaims.length + linkedFinalizedIntents.length) {
    throw new ConvexError("Storage object has conflicting ownership and cannot be deleted");
  }
}

/** Legacy readers remain available, but cannot serve asset-pipeline objects. */
export async function assertStorageNotBoundToAsset(ctx: Context, storageId: Id<"_storage">) {
  const claims = await Promise.all([
    ctx.db.query("assetUploadIntents").withIndex("by_storage", q => q.eq("storageId", storageId)).take(1),
    ctx.db.query("schoolAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(1),
    ctx.db.query("schoolAssets").withIndex("by_rollback_storage", q => q.eq("rollbackStorageId", storageId)).take(1),
    ctx.db.query("pdfCompressionCandidates").withIndex("by_candidate_storage", q => q.eq("candidateStorageId", storageId)).take(1),
  ]);
  if (claims.some(rows => rows.length)) {
    throw new ConvexError("Storage object is already bound to an upload, asset, or compression candidate");
  }
}

/** Compatibility-only read path; this does not establish new upload provenance. */
export async function getUnboundStorageUrl(ctx: Context, storageId: Id<"_storage">) {
  await assertStorageNotBoundToAsset(ctx, storageId);
  const [schools, students, materials, admissions, siteAssets, cleanup] = await Promise.all([
    ctx.db.query("schools").withIndex("by_logo_storage", q => q.eq("logoStorageId", storageId)).take(2),
    ctx.db.query("students").withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).take(2),
    ctx.db.query("knowledgeMaterials").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("admissionsDocuments").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolSiteAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("demoSeedStorageCleanup").withIndex("by_storage", q => q.eq("storageId", storageId)).take(1),
  ]);
  const claimCount = schools.length + students.length + materials.length + admissions.length + siteAssets.length;
  const acceptedApplicationPhotoReference =
    claimCount === 2 &&
    students.length === 1 &&
    admissions.length === 1 &&
    students[0].photoProvenance === "application_upload" &&
    students[0].photoSourceDocumentId === admissions[0]._id &&
    students[0].schoolId === admissions[0].schoolId;
  if (cleanup.length || (claimCount > 1 && !acceptedApplicationPhotoReference)) {
    throw new ConvexError("Storage object has conflicting ownership and cannot be served");
  }
  return ctx.storage.getUrl(storageId);
}
