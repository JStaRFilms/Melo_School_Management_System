"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import {
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialPages,
  estimateKnowledgeMaterialTokens,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialText,
  suggestKnowledgeMaterialLabels,
} from "./lessonKnowledgeIngestionHelpers";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const OCR_TIMEOUT_MS = 60_000;

type NormalizedOcrPage = {
  pageNumber: number;
  text: string;
  markdown?: string;
  confidence?: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function safeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : "OCR provider request failed";
  if (/timeout/i.test(message)) return { code: "timeout", message: "OCR provider timed out. Please try again later." };
  if (/401|403|api key|unauthorized/i.test(message)) return { code: "provider_auth", message: "OCR provider is not configured correctly." };
  if (/429|rate/i.test(message)) return { code: "rate_limited", message: "OCR provider is temporarily rate-limited. Please try again later." };
  return { code: "provider_failed", message: "OCR provider could not process this PDF. Please try again later." };
}

function normalizeMistralPages(payload: unknown): NormalizedOcrPage[] {
  const pages = payload && typeof payload === "object" ? (payload as { pages?: unknown }).pages : undefined;
  if (!Array.isArray(pages)) return [];

  return pages.flatMap((page, index) => {
    if (!page || typeof page !== "object") return [];
    const record = page as { index?: unknown; page_number?: unknown; markdown?: unknown; text?: unknown; confidence?: unknown };
    const rawPageNumber = typeof record.page_number === "number" ? record.page_number : typeof record.index === "number" ? record.index + 1 : index + 1;
    const markdown = typeof record.markdown === "string" ? normalizeKnowledgeMaterialText(record.markdown) : undefined;
    const text = typeof record.text === "string" ? normalizeKnowledgeMaterialText(record.text) : markdown;
    if (!text) return [];
    return [{
      pageNumber: rawPageNumber,
      text,
      ...(markdown ? { markdown } : {}),
      ...(typeof record.confidence === "number" ? { confidence: record.confidence } : {}),
    }];
  });
}

async function runMistralOcr(args: { apiKey: string; storageUrl: string }) {
  const response = await withTimeout(
    fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document: { type: "document_url", document_url: args.storageUrl },
        include_image_base64: false,
      }),
    }),
    OCR_TIMEOUT_MS,
    "OCR provider timed out"
  );

  if (!response.ok) {
    throw new Error(`OCR provider failed with HTTP ${response.status}`);
  }

  return normalizeMistralPages(await response.json());
}

export const processKnowledgeMaterialOcrJobInternal = internalAction({
  args: { jobId: v.id("knowledgeOcrJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.startKnowledgeMaterialOcrJobInternal, {
      jobId: args.jobId,
    });

    try {
      const apiKey = process.env.MISTRAL_API_KEY?.trim();
      if (!apiKey) {
        throw new ConvexError("OCR provider is not configured");
      }

      const storageUrl = await ctx.storage.getUrl(job.storageId);
      if (!storageUrl) {
        throw new ConvexError("Uploaded file could not be retrieved for OCR");
      }

      const pages = await runMistralOcr({ apiKey, storageUrl });
      const selectedPages = job.selectedPageNumbers?.length ? new Set(job.selectedPageNumbers) : null;
      const filteredPages = selectedPages ? pages.filter((page) => selectedPages.has(page.pageNumber)) : pages;
      const text = normalizeKnowledgeMaterialText(filteredPages.map((page) => page.text).join("\n\n"));

      if (!text || !isLikelyReadableKnowledgeMaterialText(text)) {
        throw new ConvexError("OCR provider returned no readable text for this PDF");
      }

      const labels = suggestKnowledgeMaterialLabels({
        title: job.title,
        topicLabel: job.topicLabel,
        description: job.description ?? undefined,
        extractedText: text,
      });
      const searchText = buildKnowledgeMaterialSearchText([
        job.title,
        job.topicLabel,
        job.description ?? undefined,
        ...labels,
        text.slice(0, 1200),
      ]);
      const chunks = chunkKnowledgeMaterialPages(filteredPages, { chunkSize: 1200, maxChunks: 24 }).map((chunk) => ({
        ...chunk,
        tokenEstimate: estimateKnowledgeMaterialTokens(chunk.chunkText),
      }));

      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.completeKnowledgeMaterialOcrJobInternal, {
        jobId: args.jobId,
        status: "succeeded",
        errorCode: null,
        errorMessage: null,
      });

      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: job.materialId,
        actorUserId: job.requestedByUserId,
        actorRole: job.actorRole,
        schoolId: job.schoolId,
        status: "ready",
        searchText,
        labelSuggestions: labels,
        chunks,
        ingestionErrorMessage: null,
      });
      return null;
    } catch (error) {
      const safe = safeProviderError(error);
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.completeKnowledgeMaterialOcrJobInternal, {
        jobId: args.jobId,
        status: "failed",
        errorCode: safe.code,
        errorMessage: safe.message,
      });
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: job.materialId,
        actorUserId: job.requestedByUserId,
        actorRole: job.actorRole,
        schoolId: job.schoolId,
        status: "ocr_needed",
        searchText: buildKnowledgeMaterialSearchText([job.title, job.topicLabel, job.description ?? undefined]),
        labelSuggestions: suggestKnowledgeMaterialLabels({ title: job.title, topicLabel: job.topicLabel, description: job.description ?? undefined }),
        chunks: [],
        ingestionErrorMessage: safe.message,
      });
      return null;
    }
  },
});
