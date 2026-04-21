"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import {
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialText,
  estimateKnowledgeMaterialTokens,
  normalizeKnowledgeMaterialText,
  suggestKnowledgeMaterialLabels,
  type KnowledgeMaterialIngestionSnapshot,
} from "./lessonKnowledgeIngestionHelpers";
import { inflateSync } from "node:zlib";

function decodePdfLiteralString(raw: string): string {
  let output = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = raw[index + 1];
    if (!next) {
      break;
    }

    if (next === "n") {
      output += "\n";
      index += 1;
      continue;
    }
    if (next === "r") {
      output += "\r";
      index += 1;
      continue;
    }
    if (next === "t") {
      output += "\t";
      index += 1;
      continue;
    }
    if (next === "b") {
      output += "\b";
      index += 1;
      continue;
    }
    if (next === "f") {
      output += "\f";
      index += 1;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      output += next;
      index += 1;
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octal = raw.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0];
      if (octal) {
        output += String.fromCharCode(parseInt(octal, 8));
        index += octal.length;
        continue;
      }
    }

    output += next;
    index += 1;
  }

  return output;
}

function decodePdfStringBody(body: string) {
  return decodePdfLiteralString(body)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function decodePdfHexString(hex: string): string {
  if (!hex || hex.length % 2 !== 0) {
    return "";
  }

  try {
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      const swapped = Buffer.alloc(bytes.length - 2);
      for (let index = 2, out = 0; index + 1 < bytes.length; index += 2, out += 2) {
        swapped[out] = bytes[index + 1];
        swapped[out + 1] = bytes[index];
      }
      return swapped.toString("utf16le").trim();
    }

    return bytes.toString("utf8").trim();
  } catch {
    return "";
  }
}

function getPdfContentStrings(content: string): string[] {
  const collected: string[] = [];

  for (const match of content.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj/g)) {
    const literal = match[0].slice(1, match[0].lastIndexOf(")"));
    const decoded = decodePdfStringBody(literal);
    if (decoded) collected.push(decoded);
  }

  for (const match of content.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const block = match[1];
    for (const stringMatch of block.matchAll(/\((?:\\.|[^\\()])*\)/g)) {
      const literal = stringMatch[0].slice(1, -1);
      const decoded = decodePdfStringBody(literal);
      if (decoded) collected.push(decoded);
    }
  }

  for (const match of content.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const hex = match[1].replace(/\s+/g, "");
    const decoded = decodePdfHexString(hex);
    if (decoded) {
      collected.push(decoded);
    }
  }

  return collected;
}

function inflatePdfStream(streamContent: string) {
  const buffer = Buffer.from(streamContent, "latin1");
  return inflateSync(buffer).toString("latin1");
}

function extractNativePdfText(buffer: Buffer, contentType?: string) {
  const pdfText = buffer.toString("latin1");
  const extractedSegments: string[] = [];
  const streamMatches = [...pdfText.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];

  for (const match of streamMatches) {
    const streamBody = match[1];
    const beforeStream = pdfText.slice(Math.max(0, (match.index ?? 0) - 256), match.index ?? 0);
    const isFlateDecoded = /\/FlateDecode/.test(beforeStream);
    const content = isFlateDecoded ? inflatePdfStream(streamBody) : streamBody;
    extractedSegments.push(...getPdfContentStrings(content));
  }

  if (extractedSegments.length === 0 && contentType?.includes("pdf")) {
    extractedSegments.push(...getPdfContentStrings(pdfText));
  }

  const combined = normalizeKnowledgeMaterialText(extractedSegments.join(" "));
  const letters = (combined.match(/[A-Za-z]/g) ?? []).length;
  const words = combined ? combined.split(/\s+/).length : 0;
  const adequate = words >= 20 || letters >= 120;
  return {
    text: combined,
    adequate,
  };
}

function extractReadableTextFromBuffer(buffer: Buffer, contentType?: string) {
  if (contentType?.includes("pdf") || buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    const extracted = extractNativePdfText(buffer, contentType);
    if (extracted.adequate) {
      return {
        status: "ready" as const,
        text: extracted.text,
        errorMessage: null,
      };
    }

    return {
      status: "ocr_needed" as const,
      text: extracted.text,
      errorMessage:
        "Native PDF text extraction was inadequate; OCR fallback is needed before indexing.",
    };
  }

  const decoded = new TextDecoder().decode(buffer);
  const normalized = normalizeKnowledgeMaterialText(decoded);
  const letters = (normalized.match(/[A-Za-z]/g) ?? []).length;
  const words = normalized ? normalized.split(/\s+/).length : 0;

  if (words >= 20 || letters >= 120) {
    return {
      status: "ready" as const,
      text: normalized,
      errorMessage: null,
    };
  }

  return {
    status: "ocr_needed" as const,
    text: normalized,
    errorMessage:
      "The uploaded file did not produce enough readable text for native indexing; OCR fallback is needed.",
  };
}

function buildSourceText(args: KnowledgeMaterialIngestionSnapshot) {
  return buildKnowledgeMaterialSearchText([
    args.title,
    args.topicLabel,
    args.description ?? undefined,
    args.externalUrl ?? undefined,
  ]);
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
  const enrichedSearchText = buildKnowledgeMaterialSearchText([
    sourceText,
    ...labels,
  ]);
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
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    storageId: v.optional(v.id("_storage")),
    storageContentType: v.optional(v.string()),
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
        await ctx.runMutation(
          internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal,
          {
            materialId: args.materialId,
            actorUserId: args.ownerUserId,
            actorRole: args.ownerRole,
            schoolId: args.schoolId,
            status: result.status,
            searchText: result.searchText,
            labelSuggestions: result.labels,
            chunks: result.chunks,
            ingestionErrorMessage: result.ingestionErrorMessage,
          }
        );
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
      const extracted = extractReadableTextFromBuffer(buffer, args.storageContentType);

      const labels = suggestKnowledgeMaterialLabels({
        title: args.title,
        topicLabel: args.topicLabel,
        description: args.description,
        extractedText: extracted.text,
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
          ? chunkKnowledgeMaterialText(extracted.text, {
              chunkSize: 1200,
              maxChunks: 24,
            }).map((chunkText, index) => ({
              chunkIndex: index,
              chunkText,
              tokenEstimate: estimateKnowledgeMaterialTokens(chunkText),
            }))
          : [];

      await ctx.runMutation(
        internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal,
        {
          materialId: args.materialId,
          actorUserId: args.ownerUserId,
          actorRole: args.ownerRole,
          schoolId: args.schoolId,
          status: extracted.status,
          searchText,
          labelSuggestions: labels,
          chunks,
          ingestionErrorMessage: extracted.errorMessage,
        }
      );

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Knowledge material ingestion failed";
      await ctx.runMutation(
        internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal,
        {
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
        }
      );
      return null;
    }
  },
});
