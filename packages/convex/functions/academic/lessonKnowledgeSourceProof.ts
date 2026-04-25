import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { normalizeKnowledgeMaterialText } from "./lessonKnowledgeIngestionHelpers";

export const knowledgeMaterialSourceProofValidator = v.object({
  originalFileState: v.union(
    v.literal("available"),
    v.literal("missing"),
    v.literal("orphaned")
  ),
  originalFileUrl: v.union(v.string(), v.null()),
  originalFileContentType: v.union(v.string(), v.null()),
  originalFileSize: v.union(v.number(), v.null()),
  originalFileNotice: v.union(v.string(), v.null()),
  extractedTextPreview: v.union(v.string(), v.null()),
  extractedTextChunkCount: v.number(),
});

export type KnowledgeMaterialSourceProof = {
  originalFileState: "available" | "missing" | "orphaned";
  originalFileUrl: string | null;
  originalFileContentType: string | null;
  originalFileSize: number | null;
  originalFileNotice: string | null;
  extractedTextPreview: string | null;
  extractedTextChunkCount: number;
};

export const knowledgeMaterialOriginalFileAccessValidator = v.object({
  downloadUrl: v.string(),
  contentType: v.union(v.string(), v.null()),
  size: v.union(v.number(), v.null()),
});

export async function readKnowledgeMaterialOriginalFileAccess(
  ctx: QueryCtx,
  args: {
    storageId: Id<"_storage"> | null;
  }
): Promise<{
  downloadUrl: string;
  contentType: string | null;
  size: number | null;
}> {
  if (!args.storageId) {
    throw new ConvexError("No original file is stored for this material");
  }

  const storageMeta = await ctx.db.system.get("_storage", args.storageId);
  if (!storageMeta) {
    throw new ConvexError("The original file is missing from storage");
  }

  const downloadUrl = await ctx.storage.getUrl(args.storageId);
  if (!downloadUrl) {
    throw new ConvexError("The original file could not be signed for access right now");
  }

  return {
    downloadUrl,
    contentType: storageMeta.contentType ?? null,
    size: storageMeta.size,
  };
}

export async function readKnowledgeMaterialSourceProof(
  ctx: QueryCtx,
  args: {
    schoolId: Id<"schools">;
    materialId: Id<"knowledgeMaterials">;
    storageId: Id<"_storage"> | null;
    previewChunkCount?: number;
    previewCharLimit?: number;
  }
): Promise<KnowledgeMaterialSourceProof> {
  const previewChunkCount = Math.max(1, Math.min(args.previewChunkCount ?? 3, 6));
  const previewCharLimit = Math.max(120, Math.min(args.previewCharLimit ?? 420, 1200));

  let originalFileUrl: string | null = null;
  let originalFileContentType: string | null = null;
  let originalFileSize: number | null = null;
  let originalFileState: KnowledgeMaterialSourceProof["originalFileState"] = "missing";
  let originalFileNotice: string | null = null;

  if (args.storageId) {
    const storageMeta = await ctx.db.system.get("_storage", args.storageId);
    if (!storageMeta) {
      originalFileState = "orphaned";
      originalFileNotice = "The original file reference exists, but the stored file is missing.";
    } else {
      originalFileContentType = storageMeta.contentType ?? null;
      originalFileSize = storageMeta.size;
      const signedUrl = await ctx.storage.getUrl(args.storageId);
      if (signedUrl) {
        originalFileState = "available";
        originalFileUrl = `/api/knowledge/materials/${String(args.materialId)}/original`;
      } else {
        originalFileState = "orphaned";
        originalFileNotice = "The original file could not be signed for access right now.";
      }
    }
  } else {
    originalFileNotice = "No original file was stored for this material.";
  }

  const chunks = await ctx.db
    .query("knowledgeMaterialChunks")
    .withIndex("by_school_and_material", (q) =>
      q.eq("schoolId", args.schoolId).eq("materialId", args.materialId)
    )
    .order("asc")
    .take(previewChunkCount);

  const extractedTextPreviewRaw = chunks.map((chunk) => chunk.chunkText).join(" ").trim();
  const extractedTextPreview = extractedTextPreviewRaw
    ? normalizeKnowledgeMaterialText(extractedTextPreviewRaw).slice(0, previewCharLimit)
    : null;

  return {
    originalFileState,
    originalFileUrl,
    originalFileContentType,
    originalFileSize,
    originalFileNotice,
    extractedTextPreview,
    extractedTextChunkCount: chunks.length,
  };
}
