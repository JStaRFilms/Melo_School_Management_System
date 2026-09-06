import { assertStorageClaimedOnlyBy, secureUploadUnavailable } from "./assetStorageBoundary";
import { assetMetadata } from "./assetWorkspace";
import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { requireCapability } from "./rbac";
import { PDFDocument, PDFSignature } from "pdf-lib";
export { getWorkspace, listAssets, inspectAsset, editMetadata, setArchived, listShareRecipients, listSharedAssets, setBranchShare, configurePolicy } from "./assetWorkspace";

/**
 * School Asset Security, Navigable Trash, and Pure-JS PDF Compression (H9 / MX-14)
 *
 * Invariants:
 * 1. Quarantine-First Pipeline: All uploaded assets enter "quarantined" status.
 *    No unscanned or infected asset may be downloaded or served.
 * 2. Navigable Trash Workspace: Trashed assets enter a first-class trash workspace
 *    with a 30-day auto-purge countdown. Permanent purge is strictly blocked if
 *    an active retention hold exists.
 * 3. Pure-JS PDF Compression Verification:
 *    - Ghostscript / QPDF / Poppler / ImageMagick native binaries STRICTLY BARRED.
 *    - Pure-JS `pdf-lib` structural optimization only.
 *    - Must preserve exact page counts.
 *    - Must achieve >10% savings gate (newBytes < 0.90 * origBytes).
 *    - Original copy preserved in rollbackStorageId for 14-day rollback.
 */

function assertPdfPromotionApproved(): void {
  throw new ConvexError("PDF promotion unavailable: D03 runtime and fidelity approval required");
}

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const COMPRESSION_ROLLBACK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);

export interface PdfCompressionVerificationResult {
  verified: boolean;
  reason?: string;
  originalPageCount?: number;
  compressedPageCount?: number;
  originalSizeBytes?: number;
  compressedSizeBytes?: number;
  savingsPercentage?: number;
}

/**
 * Pure-JS PDF compression verification helper using `pdf-lib`.
 * Native binaries (Ghostscript, QPDF, Poppler) are STRICTLY EXCLUDED.
 *
 * Verifies:
 * 1. Exact page count preservation: compPages === origPages
 * 2. >10% savings threshold: compBytes < 0.90 * origBytes
 */
export async function verifyPdfCompressionCandidate(
  originalBytes: Uint8Array | ArrayBuffer,
  compressedBytes: Uint8Array | ArrayBuffer
): Promise<PdfCompressionVerificationResult> {
  const origSize = originalBytes.byteLength;
  const compSize = compressedBytes.byteLength;

  if (origSize === 0 || compSize === 0) {
    return {
      verified: false,
      reason: "Invalid PDF candidate: zero-byte input",
    };
  }

  const originalText = new TextDecoder("latin1").decode(originalBytes);
  const candidateText = new TextDecoder("latin1").decode(compressedBytes);
  if (originalText.includes("/ByteRange") || candidateText.includes("/ByteRange")) {
    return { verified: false, reason: "Digitally signed PDFs are not eligible for compression" };
  }

  let origDoc: PDFDocument;
  let compDoc: PDFDocument;
  try {
    origDoc = await PDFDocument.load(originalBytes);
  } catch (error: unknown) {
    return { verified: false, reason: `Failed to parse original PDF structure: ${error instanceof Error ? error.message : "Malformed PDF"}` };
  }
  try {
    compDoc = await PDFDocument.load(compressedBytes);
  } catch (error: unknown) {
    return { verified: false, reason: `Failed to parse compressed PDF structure: ${error instanceof Error ? error.message : "Malformed PDF"}` };
  }
  if (origDoc.isEncrypted || compDoc.isEncrypted) {
    return { verified: false, reason: "Encrypted PDFs are not eligible for compression" };
  }
  const originalFields = origDoc.getForm().getFields();
  const candidateFields = compDoc.getForm().getFields();
  if (originalFields.length > 0 || candidateFields.length > 0 || originalFields.some((field) => field instanceof PDFSignature)) {
    return { verified: false, reason: "PDF forms or signatures are not eligible for compression" };
  }

  const origPageCount = origDoc.getPageCount();
  const compPageCount = compDoc.getPageCount();

  // 1. Page Count Integrity Check (Exact preservation required)
  if (origPageCount !== compPageCount) {
    return {
      verified: false,
      reason: `Page count mismatch: original has ${origPageCount} pages, compressed has ${compPageCount} pages. Document corruption detected.`,
      originalPageCount: origPageCount,
      compressedPageCount: compPageCount,
      originalSizeBytes: origSize,
      compressedSizeBytes: compSize,
    };
  }

  // 2. Minimum Savings Gate (>10% reduction required)
  const savingsBytes = origSize - compSize;
  const savingsPercentage = (savingsBytes / origSize) * 100;

  if (savingsPercentage <= 10.0 || compSize >= origSize * 0.90) {
    return {
      verified: false,
      reason: `Savings gate not met: achieved ${savingsPercentage.toFixed(1)}% savings. Minimum 10.0% savings required to justify replacement.`,
      originalPageCount: origPageCount,
      compressedPageCount: compPageCount,
      originalSizeBytes: origSize,
      compressedSizeBytes: compSize,
      savingsPercentage,
    };
  }

  return {
    verified: true,
    originalPageCount: origPageCount,
    compressedPageCount: compPageCount,
    originalSizeBytes: origSize,
    compressedSizeBytes: compSize,
    savingsPercentage,
  };
}

function detectMagicMimeType(bytes: Uint8Array): string | null {
  const matches = (...expected: number[]) => expected.every((value, index) => bytes[index] === value);
  if (matches(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (matches(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (matches(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (matches(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (matches(0x50, 0x4b, 0x03, 0x04)) return "application/zip";
  return null;
}

function hasExpectedMagicBytes(mimeType: string, bytes: Uint8Array): boolean {
  const detected = detectMagicMimeType(bytes);
  return detected === mimeType || (detected === "application/zip" && (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
}

type StorageBucketDelta = {
  active?: number;
  trash?: number;
  temp?: number;
};

function validationStatusOf(asset: Doc<"schoolAssets">): "pending" | "valid" | "invalid" {
  // Legacy rows have not undergone controlled magic-byte validation.
  return asset.validationStatus ?? "pending";
}

function assertAssetAccountingInitialized(asset: Doc<"schoolAssets">): void {
  if (asset.storageAccountingInitializedAt === undefined || asset.storageReconciliationState) {
    throw new ConvexError("Asset lifecycle is blocked until storage accounting migration completes");
  }
}

async function applyStorageAccounting(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  delta: StorageBucketDelta
): Promise<void> {
  const allocation = await ctx.db
    .query("usageMeterAllocations")
    .withIndex("by_school_and_meter", (q) =>
      q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")
    )
    .unique();
  if (!allocation) {
    throw new ConvexError("Storage quota allocation is missing");
  }
  const activeStorageBytes = (allocation.activeStorageBytes ?? 0) + (delta.active ?? 0);
  const trashStorageBytes = (allocation.trashStorageBytes ?? 0) + (delta.trash ?? 0);
  const tempStorageBytes = (allocation.tempStorageBytes ?? 0) + (delta.temp ?? 0);
  const consumedUnits = allocation.consumedUnits + (delta.active ?? 0) + (delta.trash ?? 0) + (delta.temp ?? 0);
  if (activeStorageBytes < 0 || trashStorageBytes < 0 || tempStorageBytes < 0 || consumedUnits < 0) {
    throw new ConvexError("Storage accounting would become negative");
  }
  await ctx.db.patch(allocation._id, {
    activeStorageBytes,
    trashStorageBytes,
    tempStorageBytes,
    consumedUnits,
    updatedAt: Date.now(),
  });
}

/** Issuance remains closed until transport can reserve and own every uploaded byte. */
export const createAssetUploadIntent = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.upload");
    return secureUploadUnavailable<{
      intentId: Id<"assetUploadIntents">;
      uploadUrl: string;
    }>();
  },
});

/** Generic storage IDs are never accepted as asset ownership evidence. */
export const finalizeAssetUpload = mutation({
  args: {
    schoolId: v.id("schools"),
    uploadIntentId: v.id("assetUploadIntents"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.upload");
    return secureUploadUnavailable<{ assetId: Id<"schoolAssets"> }>();
  },
});

/** Supplies an internal action with the minimum storage reference needed for byte inspection. */
export const getAssetValidationInput = internalQuery({
  args: { assetId: v.id("schoolAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    return asset ? { storageId: asset.storageId, mimeType: asset.mimeType } : null;
  },
});

/** Records the result of controlled server-side signature validation. */
export const recordAssetMagicValidation = internalMutation({
  args: { assetId: v.id("schoolAssets"), valid: v.boolean(), mimeType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;
    if (validationStatusOf(asset) !== "pending") return asset;
    await ctx.db.patch(asset._id, { validationStatus: args.valid ? "valid" : "invalid", mimeType: args.valid && args.mimeType ? args.mimeType : asset.mimeType, updatedAt: Date.now() });
    return await ctx.db.get(asset._id);
  },
});

/** Performs magic-byte validation in the storage-capable action runtime. */
export const validateAssetMagicBytes = internalAction({
  args: { assetId: v.id("schoolAssets") },
  handler: async (ctx, args): Promise<Doc<"schoolAssets"> | null> => {
    const input: { storageId: Id<"_storage">; mimeType: string } | null = await ctx.runQuery(
      internal.functions.academic.assets.getAssetValidationInput,
      { assetId: args.assetId }
    );
    if (!input) return null;
    const blob = await ctx.storage.get(input.storageId);
    const bytes = blob ? new Uint8Array(await blob.slice(0, 16).arrayBuffer()) : new Uint8Array();
    const detectedMimeType = detectMagicMimeType(bytes);
    const valid = Boolean(detectedMimeType) && (input.mimeType === "application/octet-stream" || hasExpectedMagicBytes(input.mimeType, bytes));
    const mimeType = detectedMimeType === "application/zip" ? input.mimeType : detectedMimeType ?? undefined;
    return await ctx.runMutation(internal.functions.academic.assets.recordAssetMagicValidation, { assetId: args.assetId, valid, mimeType });
  },
});

/** Moves a finalized asset into a scanner-owned state without selecting a scanner vendor. */
export const beginAssetScan = internalMutation({
  args: { assetId: v.id("schoolAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new ConvexError("Asset not found");
    if (asset.scanStatus === "scanning") return asset;
    if (validationStatusOf(asset) !== "valid" || asset.scanStatus !== "quarantined") throw new ConvexError("Only signature-validated quarantined assets can be submitted for scanning");
    await ctx.db.patch(asset._id, { scanStatus: "scanning", updatedAt: Date.now() });
    return await ctx.db.get(asset._id);
  },
});

/** Failure evidence never clears quarantine or dispatches a provider retry. */
export const recordAssetScanFailure = internalMutation({
  args: { assetId: v.id("schoolAssets"), code: v.union(v.literal("unavailable"), v.literal("timeout"), v.literal("scanner_failed")) },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;
    if (asset.scanStatus === "clean" || asset.scanStatus === "infected") throw new ConvexError("Terminal scan result requires security review");
    await ctx.db.patch(asset._id, { scanStatus: "failed", scanFailureCode: args.code, updatedAt: Date.now() });
    return null;
  },
});

/** Processes a result from the selected scanner after its controlled scan transition. */
export const processAssetScanResult = internalMutation({
  args: {
    assetId: v.id("schoolAssets"),
    scanResult: v.union(v.literal("clean"), v.literal("infected")),
    threatName: v.optional(v.string()),
    scannerEngine: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) throw new ConvexError("Asset not found");
    if (asset.scanStatus === "clean" || asset.scanStatus === "infected") {
      const priorLog = await ctx.db.query("assetQuarantineLogs").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).order("desc").first();
      if (priorLog?.scanResult === args.scanResult && priorLog.scannerEngine === args.scannerEngine) return asset;
      throw new ConvexError("Conflicting terminal scanner result requires security review");
    }
    if (asset.scanStatus !== "scanning") throw new ConvexError("Asset must be in scanning state before a scan result is accepted");

    const now = Date.now();
    await ctx.db.patch(args.assetId, {
      scanStatus: args.scanResult,
      threatName: args.scanResult === "infected" ? args.threatName ?? "Detected malware" : undefined,
      scannedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("assetQuarantineLogs", {
      assetId: args.assetId,
      schoolId: asset.schoolId,
      scanResult: args.scanResult,
      threatName: args.threatName,
      scannerEngine: args.scannerEngine,
      scannedAt: now,
      metadata: args.metadata,
    });

    // If infected, record Tier 1 security alert in audit system
    if (args.scanResult === "infected") {
      await recordAuditEventHelper(ctx, {
        schoolId: asset.schoolId,
        actorKind: "system",
        actorEmailSnapshot: "antivirus-scanner@melo.internal",
        module: "asset_security",
        action: "malware.signature_detected",
        targetType: "schoolAsset",
        targetId: args.assetId,
        outcome: "denied",
        safeSummary: `SECURITY ALERT: Malware detected in asset '${asset.fileName}' (${args.threatName ?? "Malware"}). File locked in quarantine.`,
        alertTier: "tier1_critical",
      });
    }

    return await ctx.db.get(args.assetId);
  },
});

/**
 * Reserved private delivery entry point; D03 approval is absent, so no URL is issued.
 * STRICT SECURITY GATE:
 * - Unscanned or infected files are rejected with an explicit security error.
 * - Trashed assets must be restored before downloading.
 */
export const getDownloadableAssetUrl = query({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.download.standard");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found in school repository");
    }

    // 1. Trashed gate
    if (asset.isTrashed) {
      throw new ConvexError(
        "Cannot download asset: File is in the Trash workspace. Restore the asset to enable downloads."
      );
    }

    // 2. Controlled signature validation and quarantine inspection gates
    if (validationStatusOf(asset) !== "valid" || asset.scanStatus !== "clean") {
      throw new ConvexError(
        `Access Denied: Asset '${asset.fileName}' is in security status '${asset.scanStatus}'. Downloads are strictly barred until authoritative antivirus inspection confirms the file is clean.`
      );
    }

    // D03 S5: metadata or a legacy clean flag is not an approved private delivery path.
    throw new ConvexError("Downloads unavailable: antivirus and private authenticated delivery approval required");
  },
});

/**
 * Moves an asset into the Navigable Trash workspace with a 30-day purge schedule.
 */
export const trashAsset = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (asset.isTrashed) {
      return assetMetadata(asset);
    }
    assertAssetAccountingInitialized(asset);

    const now = Date.now();
    const policy = await ctx.db.query("assetPolicies").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    const purgeScheduledAt = now + (policy?.trashRetentionDays ?? 30) * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.assetId, {
      isTrashed: true,
      trashedAt: now,
      trashedByUserId: actor.userId,
      purgeScheduledAt,
      updatedAt: now,
    });
    await applyStorageAccounting(ctx, args.schoolId, {
      active: -asset.byteSize,
      trash: asset.byteSize,
    });
    await ctx.scheduler.runAt(purgeScheduledAt, internal.functions.academic.assets.cleanupExpiredAssetStorage, {});

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: actor.userId ? "user" : "system",
      actorEmailSnapshot: "assets-manager@melo.internal",
      module: "assets",
      action: "asset.trashed",
      targetType: "schoolAsset",
      targetId: args.assetId,
      outcome: "success",
      safeSummary: "Asset moved to Trash; bytes remain charged until storage deletion succeeds.",
    });

    const updated = await ctx.db.get(args.assetId);
    return updated ? assetMetadata(updated) : null;
  },
});

/**
 * Lists trashed assets for `/admin/assets/trash` with 30-day countdown
 * and active retention hold indicators.
 */
export const listTrashedAssets = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    const now = Date.now();
    const trashed = await ctx.db
      .query("schoolAssets")
      .withIndex("by_school_and_trashed", (q) =>
        q.eq("schoolId", args.schoolId).eq("isTrashed", true)
      )
      .collect();

    const results = await Promise.all(
      trashed.map(async (asset) => {
        const holds = await ctx.db
          .query("assetRetentionHolds")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .collect();

        const purgeTime = asset.purgeScheduledAt ?? (asset.trashedAt ?? now) + TRASH_RETENTION_MS;
        const remainingMs = Math.max(0, purgeTime - now);
        const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

        return {
          ...assetMetadata(asset),
          daysRemainingUntilPurge: daysRemaining,
          hasRetentionHold: holds.length > 0,
          activeHolds: holds,
        };
      })
    );

    return results;
  },
});

/**
 * Restores an asset from the Trash workspace.
 */
export const restoreAsset = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.restore");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.isTrashed) {
      return assetMetadata(asset);
    }
    assertAssetAccountingInitialized(asset);

    const now = Date.now();
    await ctx.db.patch(args.assetId, {
      isTrashed: false,
      trashedAt: undefined,
      trashedByUserId: undefined,
      purgeScheduledAt: undefined,
      updatedAt: now,
    });
    await applyStorageAccounting(ctx, args.schoolId, {
      active: asset.byteSize,
      trash: -asset.byteSize,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: actor.userId ? "user" : "system",
      actorEmailSnapshot: "assets-manager@melo.internal",
      module: "assets",
      action: "asset.restored",
      targetType: "schoolAsset",
      targetId: args.assetId,
      outcome: "success",
      safeSummary: `Asset '${asset.fileName}' restored from Trash workspace to active library.`,
    });

    const updated = await ctx.db.get(args.assetId);
    return updated ? assetMetadata(updated) : null;
  },
});

/**
 * Applies a statutory or legal retention hold to an asset.
 * Prevents automated or manual permanent deletion while hold is active.
 */
export const applyRetentionHold = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    holdReason: v.string(),
    notes: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    await requireCapability(ctx, args.schoolId, "assets.holds.apply");
    if (!args.holdReason.trim() || args.holdReason.length > 200 || (args.notes?.length ?? 0) > 1000) throw new ConvexError("A bounded retention reason is required");
    const now = Date.now();
    const holdId = await ctx.db.insert("assetRetentionHolds", {
      assetId: args.assetId,
      schoolId: args.schoolId,
      holdReason: args.holdReason,
      notes: args.notes,
      appliedByUserId: actor.userId,
      appliedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: actor.userId ? "user" : "system",
      actorEmailSnapshot: "assets-compliance@melo.internal",
      module: "asset_security",
      action: "retention_hold.applied",
      targetType: "assetRetentionHold",
      targetId: holdId,
      outcome: "success",
      safeSummary: `Retention hold applied to '${asset.fileName}' (Reason: ${args.holdReason}). Purge blocked.`,
    });

    return await ctx.db.get(holdId);
  },
});

/**
 * Removes a retention hold from an asset.
 */
export const removeRetentionHold = mutation({
  args: {
    schoolId: v.id("schools"),
    holdId: v.id("assetRetentionHolds"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.holds.remove");
    const hold = await ctx.db.get(args.holdId);
    if (!hold || hold.schoolId !== args.schoolId) {
      throw new ConvexError("Retention hold not found");
    }

    await ctx.db.delete(args.holdId);
    // A hold may have outlived a scheduled deadline; retry cleanup now that the
    // legal block has been explicitly removed.
    await ctx.scheduler.runAfter(0, internal.functions.academic.assets.cleanupExpiredAssetStorage, {});

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: actor.userId ? "user" : "system",
      actorEmailSnapshot: "assets-compliance@melo.internal",
      module: "asset_security",
      action: "retention_hold.removed",
      targetType: "assetRetentionHold",
      targetId: args.holdId,
      outcome: "success",
      safeSummary: `Retention hold released for asset ${hold.assetId} (Prior Reason: ${hold.holdReason}).`,
    });

    return { success: true };
  },
});

/**
 * Permanently purges a trashed asset from storage and database.
 * Strict Invariant: Blocked if ANY active retention hold exists.
 */
export const permanentPurgeAsset = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.permanent_delete");
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      const receipt = await ctx.db.query("assetPurgeReceipts").withIndex("by_asset", q => q.eq("assetId", args.assetId)).unique();
      if (receipt?.schoolId === args.schoolId && args.confirmation === `PURGE ${receipt.fileName}`) return { success: true, assetId: args.assetId };
      throw new ConvexError("Asset not found or confirmation mismatch");
    }
    if (asset.schoolId !== args.schoolId) throw new ConvexError("Asset not found");

    if (!asset.isTrashed) {
      throw new ConvexError(
        "Permanent purge blocked: Asset must be placed in Trash workspace before purge."
      );
    }
    if (args.confirmation !== `PURGE ${asset.fileName}`) {
      throw new ConvexError("Permanent purge requires confirmation in the form 'PURGE <file name>'");
    }
    assertAssetAccountingInitialized(asset);

    // 1. Strict Retention Hold Check
    const activeHolds = await ctx.db
      .query("assetRetentionHolds")
      .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
      .collect();

    if (activeHolds.length > 0) {
      throw new ConvexError(
        `Permanent purge blocked: Asset has active retention hold '${activeHolds[0].holdReason}'. Release hold prior to purge.`
      );
    }

    // 2. Prove exclusive ownership, then delete storage before releasing quota.
    await assertStorageClaimedOnlyBy(ctx, asset.storageId, {
      purpose: "schoolAsset",
      ownerId: String(asset._id),
    });
    await ctx.storage.delete(asset.storageId);
    let rollbackByteSize = 0;
    if (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId) {
      await assertStorageClaimedOnlyBy(ctx, asset.rollbackStorageId, {
        purpose: "schoolAssetRollback",
        ownerId: String(asset._id),
      });
      const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
      rollbackByteSize = rollbackMetadata?.size ?? 0;
      await ctx.storage.delete(asset.rollbackStorageId);
    }
    await applyStorageAccounting(ctx, args.schoolId, {
      trash: -asset.byteSize,
      temp: -rollbackByteSize,
    });

    // Remove explicit grants only after storage deletion succeeds.
    const shares = await ctx.db.query("assetBranchShares").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(51);
    for (const share of shares) await ctx.db.delete(share._id);
    // Receipt permits exact confirmed retries without releasing quota twice.
    await ctx.db.insert("assetPurgeReceipts", { schoolId: args.schoolId, assetId: asset._id, fileName: asset.fileName, purgedAt: Date.now() });
    // 3. Delete database record
    await ctx.db.delete(args.assetId);

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: actor.userId ? "user" : "system",
      actorEmailSnapshot: "assets-manager@melo.internal",
      module: "assets",
      action: "asset.permanently_purged",
      targetType: "schoolAsset",
      targetId: args.assetId,
      outcome: "success",
      safeSummary: `Asset '${asset.fileName}' permanently destroyed from storage and database.`,
      retentionClass: "permanent_statutory",
    });

    return { success: true, assetId: args.assetId };
  },
});

/** Reads immutable source and candidate metadata before storage-capable verification. */
export const getPdfCompressionVerificationInput = internalQuery({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), candidateStorageId: v.id("_storage"), optimizerVersion: v.string() },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId || asset.mimeType !== "application/pdf" || validationStatusOf(asset) !== "valid" || asset.scanStatus !== "clean" || asset.isTrashed) {
      throw new ConvexError("Eligible clean PDF asset not found");
    }
    assertAssetAccountingInitialized(asset);
    const [sourceMetadata, candidateMetadata] = await Promise.all([
      ctx.db.system.get("_storage", asset.storageId),
      ctx.db.system.get("_storage", args.candidateStorageId),
    ]);
    if (!sourceMetadata || !candidateMetadata) throw new ConvexError("PDF source or candidate is missing from storage");
    const existingAsset = await ctx.db
      .query("schoolAssets")
      .withIndex("by_storage", (q) => q.eq("storageId", args.candidateStorageId))
      .unique();
    if (existingAsset) throw new ConvexError("Compression candidate storage is already bound to an asset");
    const existingCandidate = await ctx.db
      .query("pdfCompressionCandidates")
      .withIndex("by_candidate_storage", (q) => q.eq("candidateStorageId", args.candidateStorageId))
      .unique();
    if (existingCandidate && existingCandidate.assetId !== asset._id) {
      throw new ConvexError("Compression candidate storage is already bound to another asset");
    }
    return {
      sourceStorageId: asset.storageId,
      sourceSha256: sourceMetadata.sha256,
      candidateSha256: candidateMetadata.sha256,
      candidateByteSize: candidateMetadata.size,
    };
  },
});

/** Persists verifier evidence; duplicate action retries reuse the same candidate record. */
export const recordPdfCompressionCandidateEvidence = internalMutation({
  args: {
    schoolId: v.id("schools"), assetId: v.id("schoolAssets"), sourceStorageId: v.id("_storage"), sourceSha256: v.string(), candidateStorageId: v.id("_storage"), candidateSha256: v.string(), candidateByteSize: v.number(), optimizerVersion: v.string(),
    verified: v.boolean(), reason: v.optional(v.string()), originalPageCount: v.optional(v.number()), compressedPageCount: v.optional(v.number()), originalSizeBytes: v.optional(v.number()), compressedSizeBytes: v.optional(v.number()), savingsPercentage: v.optional(v.number()),
  },
  handler: async () => {
    return secureUploadUnavailable<Doc<"pdfCompressionCandidates"> | null>();
  },
});

/** Uses the storage-capable action runtime to produce PDF verifier evidence before any commit. */
export const verifyPdfCompressionCandidateForAsset = internalAction({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), candidateStorageId: v.id("_storage"), optimizerVersion: v.string() },
  handler: async () => {
    return secureUploadUnavailable<Doc<"pdfCompressionCandidates"> | null>();
  },
});

/** Commits only a server-verified candidate that still matches the current source storage version. */
export const commitOptimizedPdfAsset = internalMutation({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), candidateId: v.id("pdfCompressionCandidates") },
  handler: async (ctx, args) => {
    assertPdfPromotionApproved();
    const [asset, candidate] = await Promise.all([ctx.db.get(args.assetId), ctx.db.get(args.candidateId)]);
    if (!asset || asset.schoolId !== args.schoolId) throw new ConvexError("Asset not found");
    assertAssetAccountingInitialized(asset);
    if (!candidate || candidate.schoolId !== args.schoolId || candidate.assetId !== asset._id || candidate.status !== "verified" || candidate.sourceStorageId !== asset.storageId || candidate.compressedSizeBytes === undefined || candidate.compressedPageCount === undefined) {
      throw new ConvexError("Verified PDF candidate evidence does not match the current asset");
    }
    if (asset.rollbackStorageId) {
      throw new ConvexError("Asset already retains a rollback original");
    }
    const candidateMetadata = await ctx.db.system.get("_storage", candidate.candidateStorageId);
    if (!candidateMetadata || candidateMetadata.sha256 !== candidate.candidateSha256 || candidateMetadata.size !== candidate.compressedSizeBytes) {
      throw new ConvexError("Verified PDF candidate is no longer present in its verified storage state");
    }
    const now = Date.now();
    await ctx.db.patch(asset._id, {
      storageId: candidate.candidateStorageId,
      byteSize: candidateMetadata.size,
      sha256: candidateMetadata.sha256,
      pageCount: candidate.compressedPageCount,
      rollbackStorageId: asset.storageId,
      rollbackExpiryAt: now + COMPRESSION_ROLLBACK_WINDOW_MS,
      isOptimized: true,
      updatedAt: now,
    });
    // The verified candidate moves from temporary to active storage while the
    // prior active original becomes the retained rollback temporary copy.
    await applyStorageAccounting(ctx, args.schoolId, {
      active: candidateMetadata.size - asset.byteSize,
      temp: asset.byteSize - candidateMetadata.size,
    });
    // Promotion transfers the candidate's storage claim to the active asset;
    // retaining the candidate row would leave two durable owners for one blob.
    await ctx.db.delete(candidate._id);
    await ctx.scheduler.runAt(now + COMPRESSION_ROLLBACK_WINDOW_MS, internal.functions.academic.assets.cleanupExpiredAssetStorage, {});
    return await ctx.db.get(asset._id);
  },
});

/**
 * Rolls back an optimized PDF to its original uncompressed copy within the 14-day window.
 */
export const rollbackOptimizedPdfAsset = internalMutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.rollbackStorageId) {
      throw new ConvexError("No rollback copy available for this asset.");
    }
    if (asset.isTrashed) throw new ConvexError("Restore from Trash before rollback");
    const hold = await ctx.db.query("assetRetentionHolds").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(1);
    if (hold.length) throw new ConvexError("Retention hold blocks deletion of the replaced version during rollback");
    assertAssetAccountingInitialized(asset);

    const now = Date.now();
    if (asset.rollbackExpiryAt && now > asset.rollbackExpiryAt) {
      throw new ConvexError("Rollback window (14 days) has expired.");
    }

    const restoredStorageId = asset.rollbackStorageId;
    const compressedStorageId = asset.storageId;
    await assertStorageClaimedOnlyBy(ctx, compressedStorageId, {
      purpose: "schoolAsset",
      ownerId: String(asset._id),
    });
    await assertStorageClaimedOnlyBy(ctx, restoredStorageId, {
      purpose: "schoolAssetRollback",
      ownerId: String(asset._id),
    });
    const originalMetadata = await ctx.db.system.get("_storage", restoredStorageId);
    if (!originalMetadata) throw new ConvexError("Authoritative rollback original is missing from storage");

    await ctx.db.patch(args.assetId, {
      storageId: restoredStorageId,
      byteSize: originalMetadata.size,
      sha256: originalMetadata.sha256,
      rollbackStorageId: undefined,
      rollbackExpiryAt: undefined,
      isOptimized: false,
      updatedAt: now,
    });

    // Delete discarded compressed file before releasing its active quota.
    await ctx.storage.delete(compressedStorageId);
    await applyStorageAccounting(ctx, args.schoolId, {
      active: originalMetadata.size - asset.byteSize,
      temp: -originalMetadata.size,
    });

    return await ctx.db.get(args.assetId);
  },
});

/**
 * Deletes expired trash and expired rollback originals in bounded, idempotent
 * batches. Any active retention hold wins over both cleanup paths.
 */
export const cleanupExpiredAssetStorage = internalMutation({
  args: {
    limit: v.optional(v.number()),
    sweep: v.optional(v.union(v.literal("trash"), v.literal("rollback"), v.literal("candidate"))),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const now = Date.now();
    let cleaned = 0;
    const sweep = args.sweep ?? "trash";
    let continuation: {
      sweep: "trash" | "rollback" | "candidate";
      cursor?: string;
    } | null = null;

    if (sweep === "trash") {
      const trashed = await ctx.db
        .query("schoolAssets")
        .withIndex("by_purge_schedule", (q) => q.eq("isTrashed", true).lt("purgeScheduledAt", now))
        .paginate({ numItems: limit, cursor: args.cursor ?? null });
      for (const asset of trashed.page) {
        assertAssetAccountingInitialized(asset);
        const hold = await ctx.db.query("assetRetentionHolds").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).take(1);
        if (hold.length > 0) continue;
        await assertStorageClaimedOnlyBy(ctx, asset.storageId, {
          purpose: "schoolAsset",
          ownerId: String(asset._id),
        });
        await ctx.storage.delete(asset.storageId);
        let rollbackByteSize = 0;
        if (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId) {
          await assertStorageClaimedOnlyBy(ctx, asset.rollbackStorageId, {
            purpose: "schoolAssetRollback",
            ownerId: String(asset._id),
          });
          const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
          rollbackByteSize = rollbackMetadata?.size ?? 0;
          await ctx.storage.delete(asset.rollbackStorageId);
        }
        await applyStorageAccounting(ctx, asset.schoolId, {
          trash: -asset.byteSize,
          temp: -rollbackByteSize,
        });
        const shares = await ctx.db.query("assetBranchShares").withIndex("by_asset", q => q.eq("assetId", asset._id)).take(51);
        for (const share of shares) await ctx.db.delete(share._id);
        await recordAuditEventHelper(ctx, { schoolId: asset.schoolId, actorKind: "system", actorEmailSnapshot: "asset retention cleanup", module: "assets", action: "asset.expired_purged", targetType: "schoolAsset", targetId: asset._id, outcome: "success", safeSummary: "Expired asset storage deletion succeeded; charged bytes released.", retentionClass: "permanent_statutory" });
        await ctx.db.insert("assetPurgeReceipts", { schoolId: asset.schoolId, assetId: asset._id, fileName: asset.fileName, purgedAt: now });
        await ctx.db.delete(asset._id);
        cleaned++;
      }
      continuation = trashed.isDone
        ? { sweep: "rollback" }
        : { sweep: "trash", cursor: trashed.continueCursor };
    }

    if (sweep === "rollback") {
      const rollbackCandidates = await ctx.db
        .query("schoolAssets")
        .withIndex("by_rollback_expiry", (q) => q.lt("rollbackExpiryAt", now))
        .paginate({ numItems: limit, cursor: args.cursor ?? null });
      for (const asset of rollbackCandidates.page) {
        if (!asset.rollbackStorageId || asset.isTrashed) continue;
        assertAssetAccountingInitialized(asset);
        const hold = await ctx.db.query("assetRetentionHolds").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).take(1);
        if (hold.length > 0) continue;
        await assertStorageClaimedOnlyBy(ctx, asset.rollbackStorageId, {
          purpose: "schoolAssetRollback",
          ownerId: String(asset._id),
        });
        const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
        await ctx.storage.delete(asset.rollbackStorageId);
        await applyStorageAccounting(ctx, asset.schoolId, { temp: -(rollbackMetadata?.size ?? 0) });
        await ctx.db.patch(asset._id, { rollbackStorageId: undefined, rollbackExpiryAt: undefined, updatedAt: now });
        cleaned++;
      }
      continuation = rollbackCandidates.isDone
        ? { sweep: "candidate" }
        : { sweep: "rollback", cursor: rollbackCandidates.continueCursor };
    }

    if (sweep === "candidate") {
      const staleCandidates = await ctx.db
        .query("pdfCompressionCandidates")
        .withIndex("by_cleanup_schedule", (q) => q.lt("cleanupScheduledAt", now))
        .paginate({ numItems: limit, cursor: args.cursor ?? null });
      for (const candidate of staleCandidates.page) {
        await assertStorageClaimedOnlyBy(ctx, candidate.candidateStorageId, {
          purpose: "pdfCompressionCandidate",
          ownerId: String(candidate._id),
        });
        const metadata = await ctx.db.system.get("_storage", candidate.candidateStorageId);
        if (metadata) await ctx.storage.delete(candidate.candidateStorageId);
        if (candidate.status === "verified") {
          await applyStorageAccounting(ctx, candidate.schoolId, { temp: -candidate.byteSize });
        }
        await ctx.db.delete(candidate._id);
        cleaned++;
      }
      if (!staleCandidates.isDone) {
        continuation = { sweep: "candidate", cursor: staleCandidates.continueCursor };
      }
    }

    if (continuation) {
      await ctx.scheduler.runAfter(0, internal.functions.academic.assets.cleanupExpiredAssetStorage, {
        limit,
        ...continuation,
      });
    }
    return { cleaned };
  },
});

/**
 * Lists all active (non-trashed) assets for a school library.
 */
export const listSchoolAssets = query({
  args: {
    schoolId: v.id("schools"),
    category: v.optional(v.string()),
    scanStatus: v.optional(
      v.union(
        v.literal("quarantined"),
        v.literal("scanning"),
        v.literal("failed"),
        v.literal("clean"),
        v.literal("infected")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "assets.library.view");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    const assets = await ctx.db
      .query("schoolAssets")
      .withIndex("by_school_and_trashed", (q) =>
        q.eq("schoolId", args.schoolId).eq("isTrashed", false)
      )
      .order("desc")
      .take(limit * 2);

    const filtered = assets.filter((a) => {
      if (a.archivedAt !== undefined) return false;
      if (args.category && a.category !== args.category) return false;
      if (args.scanStatus && a.scanStatus !== args.scanStatus) return false;
      return true;
    });

    return filtered.slice(0, limit).map(assetMetadata);
  },
});
