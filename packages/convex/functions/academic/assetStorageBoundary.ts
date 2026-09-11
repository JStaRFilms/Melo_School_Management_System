import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

type Context = QueryCtx | MutationCtx;

export const SECURE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Uploads unavailable: the current storage transport cannot prove tenant and caller provenance, reserve purchased quota before transfer, or guarantee abandoned-upload cleanup";

const STORAGE_OWNERSHIP_DENIAL_MESSAGES = new Set([
  "Storage object is already bound to an upload, asset, or compression candidate",
  "Storage object has conflicting ownership and cannot be served",
]);

export function isStorageOwnershipDenied(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    typeof error.data === "string" &&
    STORAGE_OWNERSHIP_DENIAL_MESSAGES.has(error.data)
  );
}

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
  | "knowledgeMaterialUploadIntent"
  | "assetUploadIntent"
  | "schoolAsset"
  | "schoolAssetRollback"
  | "pdfCompressionCandidate"
  | "demoSeedCleanup"
  | "issuedReportLogoReference"
  | "issuedReportPhotoReference";

export type ExpectedStorageClaim = {
  purpose: StorageClaimPurpose;
  ownerId: string;
};

type CollectedStorageClaim = ExpectedStorageClaim & {
  linkedOwnerId?: string;
};

/** Every durable owner or historical reference must block destructive reuse. */
async function collectStorageClaims(ctx: Context, storageId: Id<"_storage">): Promise<CollectedStorageClaim[]> {
  const [admissions, siteAssets, schools, students, materials, knowledgeUploadIntents, intents, assets, rollbacks, candidates, cleanup, reportLogos, reportPhotos] = await Promise.all([
    ctx.db.query("admissionsDocuments").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolSiteAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schools").withIndex("by_logo_storage", q => q.eq("logoStorageId", storageId)).take(101),
    ctx.db.query("students").withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).take(2),
    ctx.db.query("knowledgeMaterials").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("knowledgeMaterialUploadIntents").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("assetUploadIntents").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_rollback_storage", q => q.eq("rollbackStorageId", storageId)).take(2),
    ctx.db.query("pdfCompressionCandidates").withIndex("by_candidate_storage", q => q.eq("candidateStorageId", storageId)).take(2),
    ctx.db.query("demoSeedStorageCleanup").withIndex("by_storage", q => q.eq("storageId", storageId)).take(2),
    ctx.db.query("issuedReportCards").withIndex("by_school_logo_storage", q => q.eq("schoolLogoStorageId", storageId)).take(2),
    ctx.db.query("issuedReportCards").withIndex("by_student_photo_storage", q => q.eq("studentPhotoStorageId", storageId)).take(2),
  ]);
  return [
    ...admissions.map(row => ({ purpose: "admissionsDocument" as const, ownerId: String(row._id) })),
    ...siteAssets.map(row => ({ purpose: "schoolSiteAsset" as const, ownerId: String(row._id) })),
    ...schools.map(row => ({ purpose: "schoolLogo" as const, ownerId: String(row._id) })),
    ...students.map(row => ({ purpose: "studentPhoto" as const, ownerId: String(row._id) })),
    ...materials.map(row => ({ purpose: "knowledgeMaterial" as const, ownerId: String(row._id) })),
    ...knowledgeUploadIntents.map(row => ({
      purpose: "knowledgeMaterialUploadIntent" as const,
      ownerId: String(row._id),
    })),
    ...intents.map(row => ({
      purpose: "assetUploadIntent" as const,
      ownerId: String(row._id),
      ...(row.status === "finalized" && row.assetId ? { linkedOwnerId: String(row.assetId) } : {}),
    })),
    ...assets.map(row => ({ purpose: "schoolAsset" as const, ownerId: String(row._id) })),
    ...rollbacks.map(row => ({ purpose: "schoolAssetRollback" as const, ownerId: String(row._id) })),
    ...candidates.map(row => ({ purpose: "pdfCompressionCandidate" as const, ownerId: String(row._id) })),
    ...cleanup.map(row => ({ purpose: "demoSeedCleanup" as const, ownerId: String(row._id) })),
    ...reportLogos.map(row => ({ purpose: "issuedReportLogoReference" as const, ownerId: String(row._id) })),
    ...reportPhotos.map(row => ({ purpose: "issuedReportPhotoReference" as const, ownerId: String(row._id) })),
  ];
}

/** A new claim is allowed only when no owning record exists anywhere. */
export async function assertStorageUnclaimed(ctx: Context, storageId: Id<"_storage">) {
  if ((await collectStorageClaims(ctx, storageId)).length) {
    throw new ConvexError("Storage object is already bound to another owning purpose");
  }
}

/** Reports whether a destructive operation has exactly the expected ownership. */
export async function storageClaimedOnlyBy(
  ctx: Context,
  storageId: Id<"_storage">,
  expected: ExpectedStorageClaim,
): Promise<boolean> {
  const claims = await collectStorageClaims(ctx, storageId);
  const expectedClaims = claims.filter(
    claim => claim.purpose === expected.purpose && claim.ownerId === expected.ownerId,
  );
  const allowedClaims = claims.filter(claim =>
    (claim.purpose === expected.purpose && claim.ownerId === expected.ownerId) ||
    ((expected.purpose === "schoolAsset" || expected.purpose === "schoolAssetRollback") && claim.purpose === "assetUploadIntent" && claim.linkedOwnerId === expected.ownerId) ||
    (expected.purpose === "demoSeedCleanup" && claim.purpose === "demoSeedCleanup")
  );
  return expectedClaims.length === 1 && claims.length === allowedClaims.length;
}

/** Destructive operations must prove that no other current or legacy owner exists. */
export async function assertStorageClaimedOnlyBy(
  ctx: Context,
  storageId: Id<"_storage">,
  expected: ExpectedStorageClaim,
) {
  if (!(await storageClaimedOnlyBy(ctx, storageId, expected))) {
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

export async function isSharedActiveGroupLogo(
  ctx: Context,
  storageId: Id<"_storage">,
): Promise<boolean> {
  const claims = await collectStorageClaims(ctx, storageId);
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_logo_storage", (q) => q.eq("logoStorageId", storageId))
    .take(101);
  if (
    schools.length < 2 ||
    schools.length > 100 ||
    claims.some(
      (claim) =>
        claim.purpose !== "schoolLogo" &&
        claim.purpose !== "issuedReportLogoReference",
    )
  ) {
    return false;
  }
  const links = await Promise.all(
    schools.map((school) =>
      ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .unique(),
    ),
  );
  const groupIds = new Set(
    links.map((link) => link?.groupId).filter((groupId) => groupId !== undefined),
  );
  const [groupId] = groupIds;
  const group = groupIds.size === 1 && groupId
    ? await ctx.db.get(groupId)
    : null;
  return links.every((link) => link !== null) && group?.status === "active";
}

/** Compatibility-only read path; this does not establish new upload provenance. */
export async function getUnboundStorageUrl(ctx: Context, storageId: Id<"_storage">) {
  await assertStorageNotBoundToAsset(ctx, storageId);
  const [schools, students, materials, admissions, siteAssets, cleanup] = await Promise.all([
    ctx.db.query("schools").withIndex("by_logo_storage", q => q.eq("logoStorageId", storageId)).take(101),
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
  const acceptedGroupLogoReference =
    schools.length > 1 &&
    claimCount === schools.length &&
    (await isSharedActiveGroupLogo(ctx, storageId));
  if (
    cleanup.length ||
    (claimCount > 1 &&
      !acceptedApplicationPhotoReference &&
      !acceptedGroupLogoReference)
  ) {
    throw new ConvexError("Storage object has conflicting ownership and cannot be served");
  }
  return ctx.storage.getUrl(storageId);
}
