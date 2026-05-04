"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import {
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialPages,
  estimateKnowledgeMaterialTokens,
  isKnowledgeMaterialImageContentType,
  isKnowledgeMaterialPdfContentType,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialContentType,
  normalizeKnowledgeMaterialText,
  suggestKnowledgeMaterialLabels,
} from "./lessonKnowledgeIngestionHelpers";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_OCR_MODEL = "google/gemma-4-31b-it:free";
const OPENROUTER_OCR_IMAGE_MODEL = "google/gemma-4-31b-it:free";
const OPENROUTER_PDF_ENGINE = "mistral-ocr";
const OCR_TIMEOUT_MS = 60_000;

type NormalizedOcrPage = {
  pageNumber: number;
  text: string;
  markdown?: string;
  confidence?: number;
};

function withTimeout<T>(
  start: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(message));
    }, timeoutMs);
    start(controller.signal).then(
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
  if (/401|403|api key|unauthorized/i.test(message)) {
    return {
      code: "provider_auth",
      message: `OCR provider rejected the request (${message.slice(0, 220)}). Check OpenRouter credits, model access, and OCR engine access.`,
    };
  }
  if (/402|credit|payment|balance/i.test(message)) return { code: "provider_payment_required", message: "OCR provider requires available OpenRouter credits for the selected OCR flow." };
  if (/404|model|engine|plugin/i.test(message)) return { code: "provider_unavailable", message: `OCR provider configuration is unavailable (${message.slice(0, 220)}). Check the OpenRouter model and OCR engine.` };
  if (/429|rate/i.test(message)) return { code: "rate_limited", message: "OCR provider is temporarily rate-limited. Please try again later." };
  return { code: "provider_failed", message: `OCR provider could not process this stored file (${message.slice(0, 220)}). Please try again later.` };
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return null;
      }
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractOpenRouterText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";

  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;

    if (typeof content === "string") {
      const normalized = content.trim();
      if (normalized) return normalized;
    }

    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const partText = (part as { text?: unknown }).text;
          return typeof partText === "string" ? partText : "";
        })
        .join("\n")
        .trim();
      if (text) return text;
    }
  }

  return "";
}

function normalizeOcrPages(payload: unknown): NormalizedOcrPage[] {
  const pages = payload && typeof payload === "object" ? (payload as { pages?: unknown }).pages : undefined;
  if (!Array.isArray(pages)) return [];

  return pages.flatMap((page, index) => {
    if (!page || typeof page !== "object") return [];
    const record = page as { index?: unknown; pageNumber?: unknown; page_number?: unknown; markdown?: unknown; text?: unknown; confidence?: unknown };
    const rawPageNumber =
      typeof record.pageNumber === "number"
        ? record.pageNumber
        : typeof record.page_number === "number"
          ? record.page_number
          : typeof record.index === "number"
            ? record.index + 1
            : index + 1;
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

function buildOpenRouterPdfOcrBody(args: { fileData: string }) {
  return {
    model: process.env.OPENROUTER_OCR_MODEL?.trim() || OPENROUTER_OCR_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract the readable text from this school planning PDF. Return only strict JSON in this exact shape: {\"pages\":[{\"pageNumber\":1,\"text\":\"...\"}]}. Preserve page order. Do not summarize, explain, or add markdown fences.",
          },
          {
            type: "file",
            file: {
              filename: "knowledge-material.pdf",
              file_data: args.fileData,
            },
          },
        ],
      },
    ],
    temperature: 0,
    plugins: [
      {
        id: "file-parser",
        pdf: {
          engine: process.env.OPENROUTER_PDF_ENGINE?.trim() || OPENROUTER_PDF_ENGINE,
        },
      },
    ],
  };
}

function buildOpenRouterImageOcrBody(args: { imageData: string }) {
  return {
    model:
      process.env.OPENROUTER_OCR_IMAGE_MODEL?.trim() ||
      process.env.OPENROUTER_OCR_MODEL?.trim() ||
      OPENROUTER_OCR_IMAGE_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract all readable text from this uploaded school planning image. Return only strict JSON in this exact shape: {\"pages\":[{\"pageNumber\":1,\"text\":\"...\"}]}. Use pageNumber 1. Do not summarize, explain, or add markdown fences.",
          },
          {
            type: "image_url",
            image_url: {
              url: args.imageData,
            },
          },
        ],
      },
    ],
    temperature: 0,
  };
}

async function runOpenRouterMistralOcr(args: { apiKey: string; fileData: string; contentType: string }) {
  const response = await withTimeout(
    (signal) => fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
        "HTTP-Referer": "https://school-management-system.local",
        "X-Title": "School Management System",
      },
      body: JSON.stringify(
        isKnowledgeMaterialPdfContentType(args.contentType)
          ? buildOpenRouterPdfOcrBody({ fileData: args.fileData })
          : buildOpenRouterImageOcrBody({ imageData: args.fileData })
      ),
    }),
    OCR_TIMEOUT_MS,
    "OCR provider timed out"
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let providerMessage = errorText;
    try {
      const payload = JSON.parse(errorText) as { error?: { message?: string; code?: number | string; metadata?: { raw?: string } } };
      providerMessage = payload.error?.metadata?.raw || payload.error?.message || errorText;
    } catch {
      providerMessage = errorText;
    }
    throw new Error(`OpenRouter OCR failed with HTTP ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 500)}` : ""}`);
  }

  const payload = await response.json();
  const responseText = extractOpenRouterText(payload);
  const parsed = parseJsonObject(responseText);
  const pages = normalizeOcrPages(parsed);
  if (pages.length) return pages;

  const fallbackText = normalizeKnowledgeMaterialText(responseText);
  return fallbackText ? [{ pageNumber: 1, text: fallbackText }] : [];
}

async function buildStoredFileDataUrl(args: { storageUrl: string; fallbackContentType: string }) {
  const response = await fetch(args.storageUrl);
  if (!response.ok) {
    throw new ConvexError("Uploaded file could not be fetched for OCR");
  }

  const responseContentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const contentType = responseContentType && responseContentType !== "application/octet-stream"
    ? responseContentType
    : args.fallbackContentType;
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

function resolveSelectedOcrPages(args: { pages: NormalizedOcrPage[]; selectedPageNumbers?: number[] }) {
  const selectedPageNumbers = args.selectedPageNumbers;
  if (!selectedPageNumbers?.length) return args.pages;

  if (args.pages.length === selectedPageNumbers.length) {
    const pageNumbers = args.pages.map((page) => page.pageNumber);
    const selectedPageSet = new Set(selectedPageNumbers);
    const providerReturnedSelectedPages = pageNumbers.every((pageNumber) => selectedPageSet.has(pageNumber));
    if (providerReturnedSelectedPages) {
      return args.pages;
    }
    const providerReturnedSequentialPlaceholders = pageNumbers.every(
      (pageNumber, index) => pageNumber === index + 1
    );
    if (!providerReturnedSequentialPlaceholders) {
      throw new ConvexError("OCR provider returned page numbers that do not match the selected PDF pages");
    }
    return args.pages.map((page, index) => ({
      ...page,
      pageNumber: selectedPageNumbers[index],
    }));
  }

  const selectedPages = new Set(selectedPageNumbers);
  const filteredPages = args.pages.filter((page) => selectedPages.has(page.pageNumber));
  if (filteredPages.length !== selectedPageNumbers.length) {
    throw new ConvexError("OCR provider returned incomplete selected-page text for this PDF");
  }

  return filteredPages;
}

export const processKnowledgeMaterialOcrJobInternal = internalAction({
  args: { jobId: v.id("knowledgeOcrJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.startKnowledgeMaterialOcrJobInternal, {
      jobId: args.jobId,
    });

    try {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) {
        throw new ConvexError("OCR provider is not configured");
      }

      const storageUrl = await ctx.storage.getUrl(job.storageId);
      if (!storageUrl) {
        throw new ConvexError("Uploaded file could not be retrieved for OCR");
      }

      const contentType = normalizeKnowledgeMaterialContentType(job.contentType) ?? "application/octet-stream";
      const isPdf = isKnowledgeMaterialPdfContentType(contentType);
      const isImage = isKnowledgeMaterialImageContentType(contentType);
      if (!isPdf && !isImage) {
        throw new ConvexError("Provider OCR only supports stored PDFs and images");
      }

      const fileData = await buildStoredFileDataUrl({ storageUrl, fallbackContentType: contentType });
      const pages = await runOpenRouterMistralOcr({ apiKey, fileData, contentType });
      const filteredPages = resolveSelectedOcrPages({
        pages,
        selectedPageNumbers: job.selectedPageNumbers,
      });
      const text = normalizeKnowledgeMaterialText(filteredPages.map((page) => page.text).join("\n\n"));

      if (!text || !isLikelyReadableKnowledgeMaterialText(text)) {
        throw new ConvexError("OCR provider returned no readable text for this stored file");
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

      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.completeKnowledgeMaterialOcrJobInternal, {
        jobId: args.jobId,
        status: "succeeded",
        errorCode: null,
        errorMessage: null,
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
