import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { requireCapability } from "./rbac";
import { PDFDocument, PDFSignature } from "pdf-lib";

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
  if (asset.storageAccountingInitializedAt === undefined) {
    throw new ConvexError("Asset lifecycle is blocked until storage accounting migration completes");
  }
}

async function assertStorageAvailableForAssetBinding(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  const [intents, assets, rollbackAssets, candidates] = await Promise.all([
    ctx.db.query("assetUploadIntents").withIndex("by_storage", (q) => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_storage", (q) => q.eq("storageId", storageId)).take(2),
    ctx.db.query("schoolAssets").withIndex("by_rollback_storage", (q) => q.eq("rollbackStorageId", storageId)).take(2),
    ctx.db.query("pdfCompressionCandidates").withIndex("by_candidate_storage", (q) => q.eq("candidateStorageId", storageId)).take(2),
  ]);
  if (intents.length > 0 || assets.length > 0 || rollbackAssets.length > 0 || candidates.length > 0) {
    throw new ConvexError("Storage object is already bound to an upload, asset, or compression candidate");
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

function assetFinalizeResponse(assetId: Id<"schoolAssets">) {
  return { assetId };
}

/** Issues a controlled private-upload intent. Finalization, not the browser, owns asset metadata. */
export const createAssetUploadIntent = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.upload");
    const now = Date.now();
    const intentId = await ctx.db.insert("assetUploadIntents", {
      schoolId: args.schoolId,
      requestedByUserId: actor.userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { intentId, uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

/**
 * Finalizes a controlled upload using storage-system metadata and payload magic bytes.
 * Client-provided MIME, size, hash, and uploader values are deliberately not accepted.
 */
export const finalizeAssetUpload = mutation({
  args: {
    schoolId: v.id("schools"),
    uploadIntentId: v.id("assetUploadIntents"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(ctx, args.schoolId, "assets.upload");
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.schoolId !== args.schoolId || intent.requestedByUserId !== actor.userId) {
      throw new ConvexError("Upload intent is not owned by this caller");
    }
    if (intent.status === "finalized") {
      const existingAsset = await ctx.db
        .query("schoolAssets")
        .withIndex("by_upload_intent", (q) => q.eq("uploadIntentId", intent._id))
        .unique();
      if (!existingAsset || intent.assetId !== existingAsset._id || intent.storageId !== existingAsset.storageId) {
        throw new ConvexError("Finalized upload intent is missing its authoritative asset binding");
      }
      if (existingAsset.storageId !== args.storageId) {
        throw new ConvexError("Upload intent is already bound to a different storage object");
      }
      return assetFinalizeResponse(existingAsset._id);
    }
    if (intent.status !== "pending" || intent.storageId || intent.assetId) throw new ConvexError("Upload intent is no longer pending");
    // This is the authoritative claim: all competing binding tables are read
    // and this mutation writes the intent and asset atomically.
    await assertStorageAvailableForAssetBinding(ctx, args.storageId);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata || (metadata.contentType && !ALLOWED_MIME_TYPES.has(metadata.contentType))) {
      throw new ConvexError("Uploaded file has an unsupported authoritative content type");
    }
    if (metadata.size > MAX_FILE_SIZE_BYTES) {
      throw new ConvexError("Uploaded file exceeds the maximum permissible size of 25 MB");
    }
    const now = Date.now();
    const allocation = await ctx.db
      .query("usageMeterAllocations")
      .withIndex("by_school_and_meter", (q) => q.eq("schoolId", args.schoolId).eq("meterType", "storage_bytes"))
      .first();
    const availableBytes = allocation
      ? Math.max(0, allocation.allocatedUnits - allocation.consumedUnits - allocation.reservedUnits)
      : 0;
    if (!allocation || metadata.size > availableBytes) {
      throw new ConvexError("Storage quota is insufficient to finalize this asset");
    }
    const reservationKey = `asset-finalize:${intent._id}`;
    const consumedUnits = allocation.consumedUnits + metadata.size;
    const remainingUnits = allocation.allocatedUnits - consumedUnits - allocation.reservedUnits;
    const utilizationPercent = allocation.allocatedUnits === 0 ? 100 : Math.min(100, Math.round(((consumedUnits + allocation.reservedUnits) / allocation.allocatedUnits) * 100));
    // The storage system's size and SHA-256 are the measurement. Reservation,
    // settlement, and asset creation share this mutation transaction.
    await ctx.db.insert("usageQuotaReservations", {
      schoolId: args.schoolId,
      meterType: "storage_bytes",
      idempotencyKey: reservationKey,
      operationName: "asset_finalize",
      unitsReserved: metadata.size,
      actualUnits: metadata.size,
      measurementMetadata: { source: "convex_storage", measuredAt: now, reference: String(args.storageId) },
      status: "committed",
      allowed: true,
      allocatedUnits: allocation.allocatedUnits,
      consumedUnits,
      reservedUnits: allocation.reservedUnits,
      availableUnits: remainingUnits,
      utilizationPercent,
      committedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(allocation._id, {
      consumedUnits,
      activeStorageBytes: (allocation.activeStorageBytes ?? 0) + metadata.size,
      updatedAt: now,
    });
    await ctx.db.insert("usageEvents", {
      schoolId: args.schoolId,
      meterType: "storage_bytes",
      unitsDelta: metadata.size,
      reservationId: reservationKey,
      measurementMetadata: { source: "convex_storage", measuredAt: now, reference: String(args.storageId) },
      actorUserId: actor.userId,
      operationName: "asset_finalize",
      description: "Storage finalized from authoritative metadata",
      timestamp: now,
    });
    const assetId = await ctx.db.insert("schoolAssets", {
      schoolId: args.schoolId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: metadata.contentType ?? "application/octet-stream",
      byteSize: metadata.size,
      sha256: metadata.sha256,
      category: args.category,
      validationStatus: "pending",
      storageAccountingInitializedAt: now,
      scanStatus: "quarantined",
      isTrashed: false,
      uploadIntentId: intent._id,
      uploadedByUserId: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(intent._id, {
      storageId: args.storageId,
      assetId,
      status: "finalized",
      updatedAt: now,
    });
    return assetFinalizeResponse(assetId);
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
    if (!asset) throw new ConvexError("Asset not found");
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
    if (!input) throw new ConvexError("Asset not found");
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
 * Generates downloadable asset signed URL.
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

    const downloadUrl = await ctx.storage.getUrl(asset.storageId);
    return {
      assetId: asset._id,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      downloadUrl,
      scanStatus: asset.scanStatus,
      isOptimized: asset.isOptimized ?? false,
    };
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
      return asset;
    }
    assertAssetAccountingInitialized(asset);

    const now = Date.now();
    const purgeScheduledAt = now + TRASH_RETENTION_MS;

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
      safeSummary: `Asset '${asset.fileName}' moved to Trash workspace (Auto-purge scheduled in 30 days).`,
    });

    return await ctx.db.get(args.assetId);
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
          ...asset,
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
    const actor = await requireCapability(ctx, args.schoolId, "assets.trash.manage");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.isTrashed) {
      return asset;
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

    return await ctx.db.get(args.assetId);
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
    const actor = await requireCapability(ctx, args.schoolId, "assets.trash.manage");
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
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

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

    // 2. Delete storage before releasing its quota. A storage failure aborts
    // this mutation, so no bytes are released for an object that still exists.
    await ctx.storage.delete(asset.storageId);
    let rollbackByteSize = 0;
    if (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId) {
      const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
      rollbackByteSize = rollbackMetadata?.size ?? 0;
      await ctx.storage.delete(asset.rollbackStorageId);
    }
    await applyStorageAccounting(ctx, args.schoolId, {
      trash: -asset.byteSize,
      temp: -rollbackByteSize,
    });

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
  handler: async (ctx, args) => {
    const existingCandidates = await ctx.db
      .query("pdfCompressionCandidates")
      .withIndex("by_candidate_storage", (q) => q.eq("candidateStorageId", args.candidateStorageId))
      .take(2);
    const existing = existingCandidates[0];
    if (existing) {
      if (
        existingCandidates.length === 1 &&
        existing.schoolId === args.schoolId &&
        existing.assetId === args.assetId &&
        existing.sourceStorageId === args.sourceStorageId &&
        existing.sourceSha256 === args.sourceSha256 &&
        existing.candidateSha256 === args.candidateSha256 &&
        existing.byteSize === args.candidateByteSize
      ) return existing;
      throw new ConvexError("Storage object is already bound to an upload, asset, or compression candidate");
    }

    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId || asset.storageId !== args.sourceStorageId) {
      throw new ConvexError("Compression candidate source is not the current school asset");
    }
    assertAssetAccountingInitialized(asset);
    if (args.candidateStorageId === asset.storageId) {
      throw new ConvexError("Compression candidate cannot claim the active asset storage object");
    }
    const [sourceMetadata, candidateMetadata] = await Promise.all([
      ctx.db.system.get("_storage", args.sourceStorageId),
      ctx.db.system.get("_storage", args.candidateStorageId),
    ]);
    if (!sourceMetadata || !candidateMetadata || sourceMetadata.sha256 !== args.sourceSha256 || candidateMetadata.sha256 !== args.candidateSha256 || candidateMetadata.size !== args.candidateByteSize) {
      throw new ConvexError("Compression candidate storage metadata changed before it could be claimed");
    }
    // The preceding action is only evidence collection. This mutation makes
    // the durable claim after re-reading every competing binding.
    await assertStorageAvailableForAssetBinding(ctx, args.candidateStorageId);

    const now = Date.now();
    const { verified, candidateByteSize, ...evidence } = args;
    const cleanupScheduledAt = now + 24 * 60 * 60 * 1000;
    const candidateId = await ctx.db.insert("pdfCompressionCandidates", {
      ...evidence,
      byteSize: candidateByteSize,
      status: verified ? "verified" : "rejected",
      cleanupScheduledAt,
      verifiedAt: now,
    });
    if (verified) {
      await applyStorageAccounting(ctx, args.schoolId, { temp: candidateByteSize });
    } else {
      // Rejected candidates never become an asset and are deleted immediately;
      // their short-lived evidence is retained for idempotent audit/cleanup.
      await ctx.storage.delete(args.candidateStorageId);
    }
    await ctx.scheduler.runAt(cleanupScheduledAt, internal.functions.academic.assets.cleanupExpiredAssetStorage, {});
    return await ctx.db.get(candidateId);
  },
});

/** Uses the storage-capable action runtime to produce PDF verifier evidence before any commit. */
export const verifyPdfCompressionCandidateForAsset = internalAction({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), candidateStorageId: v.id("_storage"), optimizerVersion: v.string() },
  handler: async (ctx, args): Promise<Doc<"pdfCompressionCandidates"> | null> => {
    const input: { sourceStorageId: Id<"_storage">; sourceSha256: string; candidateSha256: string; candidateByteSize: number } = await ctx.runQuery(
      internal.functions.academic.assets.getPdfCompressionVerificationInput,
      args
    );
    const [source, candidate] = await Promise.all([ctx.storage.get(input.sourceStorageId), ctx.storage.get(args.candidateStorageId)]);
    if (!source || !candidate) throw new ConvexError("PDF source or candidate is missing from storage");
    const verification = await verifyPdfCompressionCandidate(await source.arrayBuffer(), await candidate.arrayBuffer());
    return await ctx.runMutation(internal.functions.academic.assets.recordPdfCompressionCandidateEvidence, {
      schoolId: args.schoolId,
      assetId: args.assetId,
      sourceStorageId: input.sourceStorageId,
      sourceSha256: input.sourceSha256,
      candidateStorageId: args.candidateStorageId,
      candidateSha256: input.candidateSha256,
      candidateByteSize: input.candidateByteSize,
      optimizerVersion: args.optimizerVersion,
      verified: verification.verified,
      reason: verification.reason,
      originalPageCount: verification.originalPageCount,
      compressedPageCount: verification.compressedPageCount,
      originalSizeBytes: verification.originalSizeBytes,
      compressedSizeBytes: verification.compressedSizeBytes,
      savingsPercentage: verification.savingsPercentage,
    });
  },
});

/** Commits only a server-verified candidate that still matches the current source storage version. */
export const commitOptimizedPdfAsset = internalMutation({
  args: { schoolId: v.id("schools"), assetId: v.id("schoolAssets"), candidateId: v.id("pdfCompressionCandidates") },
  handler: async (ctx, args) => {
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
    assertAssetAccountingInitialized(asset);

    const now = Date.now();
    if (asset.rollbackExpiryAt && now > asset.rollbackExpiryAt) {
      throw new ConvexError("Rollback window (14 days) has expired.");
    }

    const restoredStorageId = asset.rollbackStorageId;
    const compressedStorageId = asset.storageId;
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
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const now = Date.now();
    const trashed = await ctx.db
      .query("schoolAssets")
      .withIndex("by_purge_schedule", (q) => q.eq("isTrashed", true).lt("purgeScheduledAt", now))
      .take(limit);
    let cleaned = 0;
    for (const asset of trashed) {
      assertAssetAccountingInitialized(asset);
      const hold = await ctx.db.query("assetRetentionHolds").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).take(1);
      if (hold.length > 0) continue;
      await ctx.storage.delete(asset.storageId);
      let rollbackByteSize = 0;
      if (asset.rollbackStorageId && asset.rollbackStorageId !== asset.storageId) {
        const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
        rollbackByteSize = rollbackMetadata?.size ?? 0;
        await ctx.storage.delete(asset.rollbackStorageId);
      }
      await applyStorageAccounting(ctx, asset.schoolId, {
        trash: -asset.byteSize,
        temp: -rollbackByteSize,
      });
      await ctx.db.delete(asset._id);
      cleaned++;
    }

    const rollbackCandidates = await ctx.db
      .query("schoolAssets")
      .withIndex("by_rollback_expiry", (q) => q.lt("rollbackExpiryAt", now))
      .take(limit);
    for (const asset of rollbackCandidates) {
      if (!asset.rollbackStorageId || asset.isTrashed) continue;
      assertAssetAccountingInitialized(asset);
      const hold = await ctx.db.query("assetRetentionHolds").withIndex("by_asset", (q) => q.eq("assetId", asset._id)).take(1);
      if (hold.length > 0) continue;
      const rollbackMetadata = await ctx.db.system.get("_storage", asset.rollbackStorageId);
      await ctx.storage.delete(asset.rollbackStorageId);
      await applyStorageAccounting(ctx, asset.schoolId, { temp: -(rollbackMetadata?.size ?? 0) });
      await ctx.db.patch(asset._id, { rollbackStorageId: undefined, rollbackExpiryAt: undefined, updatedAt: now });
      cleaned++;
    }

    const staleCandidates = await ctx.db
      .query("pdfCompressionCandidates")
      .withIndex("by_cleanup_schedule", (q) => q.lt("cleanupScheduledAt", now))
      .take(limit);
    for (const candidate of staleCandidates) {
      const metadata = await ctx.db.system.get("_storage", candidate.candidateStorageId);
      if (metadata) await ctx.storage.delete(candidate.candidateStorageId);
      if (candidate.status === "verified") {
        await applyStorageAccounting(ctx, candidate.schoolId, { temp: -candidate.byteSize });
      }
      await ctx.db.delete(candidate._id);
      cleaned++;
    }
    if (trashed.length === limit || rollbackCandidates.length === limit || staleCandidates.length === limit) {
      await ctx.scheduler.runAfter(0, internal.functions.academic.assets.cleanupExpiredAssetStorage, { limit });
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
      if (args.category && a.category !== args.category) return false;
      if (args.scanStatus && a.scanStatus !== args.scanStatus) return false;
      return true;
    });

    return filtered.slice(0, limit);
  },
});
