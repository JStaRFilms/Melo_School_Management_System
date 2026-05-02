"use node";

import { ConvexError, v } from "convex/values";
import { PDFDocument } from "pdf-lib";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import {
  buildKnowledgeMaterialSearchText,
  buildMaterialSearchSeed,
  chunkKnowledgeMaterialPages,
  chunkKnowledgeMaterialText,
  estimateKnowledgeMaterialTokens,
  suggestKnowledgeMaterialLabels,
  type KnowledgeMaterialIngestionSnapshot,
} from "./lessonKnowledgeIngestionHelpers";
import { extractReadableTextFromBuffer } from "./lessonKnowledgePdfExtraction";

function buildSourceText(args: KnowledgeMaterialIngestionSnapshot) {
  return buildMaterialSearchSeed({
    title: args.title,
    topicLabel: args.topicLabel,
    description: args.description,
    externalUrl: args.externalUrl,
  });
}

async function buildSelectedPagesPdfBuffer(args: {
  buffer: Buffer;
  selectedPageNumbers: number[];
}) {
  const sourcePdf = await PDFDocument.load(new Uint8Array(args.buffer), { ignoreEncryption: true });
  const pageCount = sourcePdf.getPageCount();
  const invalidPage = args.selectedPageNumbers.find((pageNumber) => pageNumber < 1 || pageNumber > pageCount);
  if (invalidPage !== undefined) {
    throw new ConvexError(`Selected page ${invalidPage} is outside this PDF's ${pageCount} pages.`);
  }

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(
    sourcePdf,
    args.selectedPageNumbers.map((pageNumber) => pageNumber - 1)
  );
  for (const page of copiedPages) {
    outputPdf.addPage(page);
  }

  const bytes = await outputPdf.save();
  return Buffer.from(bytes);
}

async function processExternalLink(args: KnowledgeMaterialIngestionSnapshot) {
  const sourceText = buildKnowledgeMaterialSearchText([
    args.title,
    args.topicLabel,
    args.description ?? undefined,
    args.externalUrl ?? undefined,
  ]);
  const labels = suggestKnowledgeMaterialLabels({
    title: args.title,
    topicLabel: args.topicLabel,
    description: args.description ?? undefined,
    extractedText: sourceText,
    externalUrl: args.externalUrl ?? undefined,
  });
  const enrichedSearchText = buildKnowledgeMaterialSearchText([sourceText, ...labels]);
  const chunks = chunkKnowledgeMaterialText(sourceText, {
    chunkSize: 900,
    maxChunks: 3,
  }).map((chunkText, index) => ({
    chunkIndex: index,
    chunkText,
    tokenEstimate: estimateKnowledgeMaterialTokens(chunkText),
  }));

  return {
    status: "ready" as const,
    searchText: enrichedSearchText,
    labels,
    chunks,
    ingestionErrorMessage: null,
  };
}

export const processKnowledgeMaterialIngestionInternal = internalAction({
  args: {
    materialId: v.id("knowledgeMaterials"),
    schoolId: v.id("schools"),
    ownerUserId: v.id("users"),
    ownerRole: v.union(v.literal("teacher"), v.literal("admin"), v.literal("student"), v.literal("system")),
    sourceType: v.union(
      v.literal("file_upload"),
      v.literal("text_entry"),
      v.literal("youtube_link"),
      v.literal("generated_draft"),
      v.literal("student_upload"),
      v.literal("imported_curriculum")
    ),
    visibility: v.union(
      v.literal("private_owner"),
      v.literal("staff_shared"),
      v.literal("class_scoped"),
      v.literal("student_approved")
    ),
    reviewStatus: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("archived")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    subjectId: v.optional(v.id("subjects")),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    storageId: v.optional(v.id("_storage")),
    storageContentType: v.optional(v.string()),
    selectedPageRanges: v.optional(v.string()),
    selectedPageNumbers: v.optional(v.array(v.number())),
    sourceFileMode: v.optional(v.union(v.literal("original"), v.literal("selected_pages"))),
    externalUrl: v.optional(v.string()),
    searchText: v.string(),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ocr_needed"),
      v.literal("ready"),
      v.literal("failed")
    ),
    processingAttemptCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      if (args.externalUrl && !args.storageId) {
        const result = await processExternalLink(args);
        await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
          materialId: args.materialId,
          actorUserId: args.ownerUserId,
          actorRole: args.ownerRole,
          schoolId: args.schoolId,
          status: result.status,
          searchText: result.searchText,
          labelSuggestions: result.labels,
          chunks: result.chunks,
          ingestionErrorMessage: result.ingestionErrorMessage,
        });
        return null;
      }

      if (!args.storageId) {
        throw new ConvexError("Uploaded file is missing its storage reference");
      }

      const storageUrl = await ctx.storage.getUrl(args.storageId);
      if (!storageUrl) {
        throw new ConvexError("Uploaded file could not be retrieved");
      }

      const response = await fetch(storageUrl);
      if (!response.ok) {
        throw new ConvexError("Uploaded file could not be fetched");
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let extractionBuffer = buffer;
      let extractionSelectedPageNumbers = args.selectedPageNumbers;

      if (args.selectedPageNumbers?.length && args.sourceFileMode !== "selected_pages") {
        const selectedPdfBuffer = await buildSelectedPagesPdfBuffer({
          buffer,
          selectedPageNumbers: args.selectedPageNumbers,
        });
        extractionBuffer = selectedPdfBuffer;
        extractionSelectedPageNumbers = undefined;

        const selectedStorageId = await ctx.storage.store(
          new Blob([new Uint8Array(selectedPdfBuffer)], { type: "application/pdf" })
        );
        await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.replaceKnowledgeMaterialStorageInternal, {
          materialId: args.materialId,
          schoolId: args.schoolId,
          previousStorageId: args.storageId,
          nextStorageId: selectedStorageId,
          actorUserId: args.ownerUserId,
          sourcePdfPageCount: args.selectedPageNumbers.length,
        });
      }

      const extracted = await extractReadableTextFromBuffer(extractionBuffer, {
        contentType: args.storageContentType,
        selectedPageNumbers: extractionSelectedPageNumbers,
      });

      const labels = suggestKnowledgeMaterialLabels({
        title: args.title,
        topicLabel: args.topicLabel,
        description: args.description,
        extractedText: extracted.status === "ready" ? extracted.text : undefined,
        externalUrl: args.externalUrl,
      });
      const searchText = buildKnowledgeMaterialSearchText([
        args.title,
        args.topicLabel,
        args.description ?? undefined,
        args.externalUrl ?? undefined,
        ...labels,
        extracted.status === "ready" ? extracted.text.slice(0, 1200) : undefined,
      ]);
      const chunks =
        extracted.status === "ready"
          ? extracted.pages?.length
            ? chunkKnowledgeMaterialPages(extracted.pages, {
                chunkSize: 1200,
                maxChunks: 24,
              }).map((chunk) => ({
                ...chunk,
                tokenEstimate: estimateKnowledgeMaterialTokens(chunk.chunkText),
              }))
            : chunkKnowledgeMaterialText(extracted.text, {
                chunkSize: 1200,
                maxChunks: 24,
              }).map((chunkText, index) => ({
                chunkIndex: index,
                chunkText,
                tokenEstimate: estimateKnowledgeMaterialTokens(chunkText),
                ...(args.selectedPageNumbers?.length
                  ? {
                      pageStart: Math.min(...args.selectedPageNumbers),
                      pageEnd: Math.max(...args.selectedPageNumbers),
                      pageNumbers: args.selectedPageNumbers,
                    }
                  : {}),
              }))
          : [];

      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: args.materialId,
        actorUserId: args.ownerUserId,
        actorRole: args.ownerRole,
        schoolId: args.schoolId,
        status: extracted.status,
        searchText,
        labelSuggestions: labels,
        chunks,
        ...(extracted.pageCount !== undefined ? { pdfPageCount: extracted.pageCount } : {}),
        ingestionErrorMessage: extracted.errorMessage,
      });

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Knowledge material ingestion failed";
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: args.materialId,
        actorUserId: args.ownerUserId,
        actorRole: args.ownerRole,
        schoolId: args.schoolId,
        status: "failed",
        searchText: buildSourceText(args),
        labelSuggestions: suggestKnowledgeMaterialLabels({
          title: args.title,
          topicLabel: args.topicLabel,
          description: args.description,
          externalUrl: args.externalUrl,
        }),
        chunks: [],
        ingestionErrorMessage: message,
      });
      return null;
    }
  },
});
