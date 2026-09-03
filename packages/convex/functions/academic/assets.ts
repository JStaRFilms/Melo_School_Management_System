import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { PDFDocument } from "pdf-lib";

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

  let origDoc: PDFDocument;
  let compDoc: PDFDocument;

  try {
    origDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  } catch (err: any) {
    return {
      verified: false,
      reason: `Failed to parse original PDF structure: ${err?.message ?? "Malformed PDF"}`,
    };
  }

  try {
    compDoc = await PDFDocument.load(compressedBytes, { ignoreEncryption: true });
  } catch (err: any) {
    return {
      verified: false,
      reason: `Failed to parse compressed PDF structure: ${err?.message ?? "Malformed PDF"}`,
    };
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

/**
 * Registers an uploaded file into quarantine.
 * Invariant: scanStatus is set strictly to "quarantined".
 */
export const uploadAssetQuarantine = mutation({
  args: {
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    sha256: v.string(),
    category: v.string(),
    uploadedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // 1. Validate file size ceiling (25 MB)
    if (args.byteSize > MAX_FILE_SIZE_BYTES) {
      throw new ConvexError(
        `File exceeds maximum permissible size of 25 MB (${(args.byteSize / 1024 / 1024).toFixed(1)} MB uploaded)`
      );
    }

    // 2. Validate MIME type against security whitelist
    if (!ALLOWED_MIME_TYPES.has(args.mimeType)) {
      throw new ConvexError(
        `Prohibited file type: '${args.mimeType}'. Educational asset policy permits PDF, PNG, JPEG, WebP, DOCX, and XLSX only.`
      );
    }

    const now = Date.now();
    const assetId = await ctx.db.insert("schoolAssets", {
      schoolId: args.schoolId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      sha256: args.sha256,
      category: args.category,
      scanStatus: "quarantined",
      isTrashed: false,
      uploadedByUserId: args.uploadedByUserId,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(assetId);
  },
});

/**
 * Processes authoritative antivirus scan results (e.g. from AWS GuardDuty).
 * Transitions status to "clean" or "infected".
 */
export const processAssetScanResult = mutation({
  args: {
    assetId: v.id("schoolAssets"),
    scanResult: v.union(v.literal("clean"), v.literal("infected")),
    threatName: v.optional(v.string()),
    scannerEngine: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new ConvexError("Asset not found");
    }

    const now = Date.now();
    const scanner = args.scannerEngine ?? "aws_guardduty";

    await ctx.db.patch(args.assetId, {
      scanStatus: args.scanResult,
      threatName: args.scanResult === "infected" ? args.threatName ?? "Detected.Malware.Generic" : undefined,
      scannedAt: now,
      updatedAt: now,
    });

    // Record scan log
    await ctx.db.insert("assetQuarantineLogs", {
      assetId: args.assetId,
      schoolId: asset.schoolId,
      scanResult: args.scanResult,
      threatName: args.threatName,
      scannerEngine: scanner,
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

    // 2. Quarantine inspection gate
    if (asset.scanStatus !== "clean") {
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
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (asset.isTrashed) {
      return asset;
    }

    const now = Date.now();
    const purgeScheduledAt = now + TRASH_RETENTION_MS;

    await ctx.db.patch(args.assetId, {
      isTrashed: true,
      trashedAt: now,
      trashedByUserId: args.userId,
      purgeScheduledAt,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.userId ? "user" : "system",
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
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.isTrashed) {
      return asset;
    }

    const now = Date.now();
    await ctx.db.patch(args.assetId, {
      isTrashed: false,
      trashedAt: undefined,
      trashedByUserId: undefined,
      purgeScheduledAt: undefined,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.userId ? "user" : "system",
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
      appliedByUserId: args.userId,
      appliedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.userId ? "user" : "system",
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
    const hold = await ctx.db.get(args.holdId);
    if (!hold || hold.schoolId !== args.schoolId) {
      throw new ConvexError("Retention hold not found");
    }

    await ctx.db.delete(args.holdId);

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.userId ? "user" : "system",
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
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.isTrashed) {
      throw new ConvexError(
        "Permanent purge blocked: Asset must be placed in Trash workspace before purge."
      );
    }

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

    // 2. Remove underlying storage files
    await ctx.storage.delete(asset.storageId);
    if (asset.rollbackStorageId) {
      await ctx.storage.delete(asset.rollbackStorageId);
    }

    // 3. Delete database record
    await ctx.db.delete(args.assetId);

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: args.userId ? "user" : "system",
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

/**
 * Commits a verified compressed PDF candidate to the asset record.
 * Preserves the original storage ID for 14 calendar days as a rollback copy.
 */
export const commitOptimizedPdfAsset = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    compressedStorageId: v.id("_storage"),
    compressedSizeBytes: v.number(),
    pageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    const now = Date.now();
    // Preserve original file in rollback copy for 14 days
    const rollbackStorageId = asset.rollbackStorageId ?? asset.storageId;
    const rollbackExpiryAt = now + COMPRESSION_ROLLBACK_WINDOW_MS;

    await ctx.db.patch(args.assetId, {
      storageId: args.compressedStorageId,
      byteSize: args.compressedSizeBytes,
      pageCount: args.pageCount,
      rollbackStorageId,
      rollbackExpiryAt,
      isOptimized: true,
      updatedAt: now,
    });

    return await ctx.db.get(args.assetId);
  },
});

/**
 * Rolls back an optimized PDF to its original uncompressed copy within the 14-day window.
 */
export const rollbackOptimizedPdfAsset = mutation({
  args: {
    schoolId: v.id("schools"),
    assetId: v.id("schoolAssets"),
    originalSizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.schoolId !== args.schoolId) {
      throw new ConvexError("Asset not found");
    }

    if (!asset.rollbackStorageId) {
      throw new ConvexError("No rollback copy available for this asset.");
    }

    const now = Date.now();
    if (asset.rollbackExpiryAt && now > asset.rollbackExpiryAt) {
      throw new ConvexError("Rollback window (14 days) has expired.");
    }

    const restoredStorageId = asset.rollbackStorageId;
    const compressedStorageId = asset.storageId;

    await ctx.db.patch(args.assetId, {
      storageId: restoredStorageId,
      byteSize: args.originalSizeBytes,
      rollbackStorageId: undefined,
      rollbackExpiryAt: undefined,
      isOptimized: false,
      updatedAt: now,
    });

    // Delete discarded compressed file
    await ctx.storage.delete(compressedStorageId);

    return await ctx.db.get(args.assetId);
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
