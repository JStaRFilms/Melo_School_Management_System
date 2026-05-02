"use node";

import type { TextContent } from "pdfjs-dist/types/src/display/api";
import {
  MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  assertPdfPageSelectionWithinLimit,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialText,
} from "./lessonKnowledgeIngestionHelpers";

const OPENROUTER_MODEL = "google/gemma-4-31b-it:free";
const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_PDF_PARSE_TIMEOUT_MS = 20_000;
const DEFAULT_PDF_PAGE_TEXT_TIMEOUT_MS = 3_000;
const DEFAULT_OPENROUTER_TIMEOUT_MS = 20_000;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfWorkerModule = {
  WorkerMessageHandler: unknown;
};
let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsWorkerModulePromise: Promise<PdfWorkerModule> | null = null;

function ensurePdfJsGlobals() {
  const globalPdfJs = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };

  if (!globalPdfJs.DOMMatrix) {
    globalPdfJs.DOMMatrix = class DOMMatrix { } as unknown as typeof DOMMatrix;
  }

  if (!globalPdfJs.ImageData) {
    globalPdfJs.ImageData = class ImageData { } as unknown as typeof ImageData;
  }

  if (!globalPdfJs.Path2D) {
    globalPdfJs.Path2D = class Path2D { } as unknown as typeof Path2D;
  }
}

async function ensurePdfJsWorkerHandler() {
  // @ts-expect-error pdfjs-dist does not ship type declarations for the worker bundle.
  pdfJsWorkerModulePromise ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const workerModule = await pdfJsWorkerModulePromise;
  const globalPdfJs = globalThis as typeof globalThis & {
    pdfjsWorker?: {
      WorkerMessageHandler?: PdfWorkerModule["WorkerMessageHandler"];
    };
  };

  globalPdfJs.pdfjsWorker ??= {};
  globalPdfJs.pdfjsWorker.WorkerMessageHandler ??= workerModule.WorkerMessageHandler;
}

async function getPdfJsModule() {
  ensurePdfJsGlobals();
  await ensurePdfJsWorkerHandler();
  pdfJsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfJsModulePromise;
}

type PdfQuality = {
  normalizedText: string;
  letters: number;
  words: number;
  readable: boolean;
  adequate: boolean;
};

type PdfParserOutcome =
  | {
      kind: "success";
      text: string;
      pages: Array<{ pageNumber: number; text: string }>;
      quality: PdfQuality;
      pageCount: number;
    }
  | {
      kind: "page_limit";
      pageCount: number;
    }
  | {
      kind: "error";
      pageCount: number;
      errorMessage: string;
    };

type OpenRouterFallbackOutcome =
  | {
      kind: "success";
      text: string;
    }
  | {
      kind: "empty";
      errorMessage: string;
    }
  | {
      kind: "rate_limited";
      errorMessage: string;
    }
  | {
      kind: "error";
      errorMessage: string;
    };

export type KnowledgeMaterialTextExtractionResult = {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  pageCount?: number;
  errorMessage: string | null;
  extractionPath: "parser" | "openrouter" | "plain_text" | "none";
  fallbackReason:
  | "none"
  | "parser_error"
  | "scanned_or_problematic"
  | "unreadable_text"
  | "insufficient_text";
};

export type KnowledgeMaterialTextExtractionOptions = {
  contentType?: string | null;
  openRouterApiKey?: string | null;
  fetchImpl?: typeof fetch;
  pdfParseTimeoutMs?: number;
  openRouterTimeoutMs?: number;
  selectedPageNumbers?: number[];
};

function normalizeContentType(contentType?: string | null) {
  const normalized = contentType?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized.split(";")[0].trim();
}

function isPdfLikeBuffer(buffer: Buffer, contentType?: string | null) {
  const normalizedContentType = normalizeContentType(contentType);
  return normalizedContentType?.includes("pdf") || buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function evaluateTextQuality(value: string): PdfQuality {
  const normalizedText = normalizeKnowledgeMaterialText(value);
  const letters = (normalizedText.match(/[A-Za-z]/g) ?? []).length;
  const words = normalizedText ? normalizedText.split(/\s+/).length : 0;
  const readable = isLikelyReadableKnowledgeMaterialText(normalizedText);
  const adequate = readable && (words >= 20 || letters >= 120);

  return {
    normalizedText,
    letters,
    words,
    readable,
    adequate,
  };
}

function getTextFromContent(textContent: TextContent) {
  const parts = textContent.items
    .map((item: TextContent["items"][number]) => {
      if (typeof item !== "object" || item === null || !("str" in item)) {
        return "";
      }

      const text = (item as { str?: unknown }).str;
      return typeof text === "string" ? text : "";
    })
    .filter((part) => part.length > 0);

  return normalizeKnowledgeMaterialText(parts.join(" "));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        onTimeout();
      } catch {
        // Ignore cleanup errors and surface the timeout below.
      }
      reject(new Error(timeoutMessage));
    }, timeoutMs);

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

async function parsePdfBuffer(buffer: Buffer, options: { timeoutMs: number; selectedPageNumbers?: number[] }): Promise<PdfParserOutcome> {
  const { getDocument } = await getPdfJsModule();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const timeoutMs = options.timeoutMs;
  const startedAt = Date.now();

  function remainingTimeoutMs() {
    return Math.max(1, timeoutMs - (Date.now() - startedAt));
  }

  try {
    const documentProxy = await withTimeout(
      loadingTask.promise,
      remainingTimeoutMs(),
      () => {
        void loadingTask.destroy();
      },
      "PDF parsing timed out"
    );

    const pageCount = documentProxy.numPages;
    const selectedPageNumbers = options.selectedPageNumbers?.length ? Array.from(new Set(options.selectedPageNumbers)).sort((a, b) => a - b) : undefined;
    if (selectedPageNumbers) {
      assertPdfPageSelectionWithinLimit({ selectedPageNumbers, maxPageCount: pageCount });
    }
    if (!selectedPageNumbers && pageCount > MAX_KNOWLEDGE_MATERIAL_PDF_PAGES) {
      return {
        kind: "page_limit",
        pageCount,
      };
    }

    const pageTexts: string[] = [];
    const pages: Array<{ pageNumber: number; text: string }> = [];
    const pagesToRead = selectedPageNumbers ?? Array.from({ length: pageCount }, (_, index) => index + 1);
    for (const pageNumber of pagesToRead) {
      if (remainingTimeoutMs() <= 1) {
        break;
      }

      try {
        const page = await withTimeout(
          documentProxy.getPage(pageNumber),
          Math.min(DEFAULT_PDF_PAGE_TEXT_TIMEOUT_MS, remainingTimeoutMs()),
          () => undefined,
          `PDF page ${pageNumber} loading timed out`
        );
        const textContent = await withTimeout(
          page.getTextContent(),
          Math.min(DEFAULT_PDF_PAGE_TEXT_TIMEOUT_MS, remainingTimeoutMs()),
          () => undefined,
          `PDF page ${pageNumber} text extraction timed out`
        );
        const pageText = getTextFromContent(textContent);
        if (pageText) {
          pageTexts.push(pageText);
          pages.push({ pageNumber, text: pageText });
        }
      } catch {
        // Mixed PDFs can include image-heavy/problematic pages. Keep any native text
        // extracted from other pages instead of escalating the whole PDF to OCR.
      }

      const currentQuality = evaluateTextQuality(pageTexts.join("\n\n"));
      if (currentQuality.adequate) {
        return {
          kind: "success",
          text: currentQuality.normalizedText,
          pages,
          quality: currentQuality,
          pageCount,
        };
      }
    }

    const quality = evaluateTextQuality(pageTexts.join("\n\n"));
    return {
      kind: "success",
      text: quality.normalizedText,
      pages,
      quality,
      pageCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parsing failed";
    return {
      kind: "error",
      pageCount: 0,
      errorMessage: message,
    };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function buildOpenRouterRequestBody(buffer: Buffer) {
  return {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract the visible text from this school PDF. Return only the text, preserve headings and line breaks, and do not summarize or add commentary.",
          },
          {
            type: "file",
            file: {
              filename: "knowledge-material.pdf",
              file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
            },
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 8192,
    plugins: [
      {
        id: "file-parser",
        pdf: {
          engine: "cloudflare-ai",
        },
      },
    ],
  };
}

function parseOpenRouterTextResponse(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    return "";
  }

  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }

    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") {
      continue;
    }

    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") {
      const normalized = normalizeKnowledgeMaterialText(content);
      if (normalized) {
        return normalized;
      }
    }

    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (!part || typeof part !== "object") {
            return "";
          }

          const partText = (part as { text?: unknown }).text;
          return typeof partText === "string" ? partText : "";
        })
        .join(" ");
      const normalized = normalizeKnowledgeMaterialText(text);
      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

async function extractPdfTextWithOpenRouter(args: {
  buffer: Buffer;
  apiKey: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  selectedPageNumbers?: number[];
}): Promise<OpenRouterFallbackOutcome> {
  try {
    const response = await withTimeout(
      args.fetchImpl(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
          "HTTP-Referer": "https://school-management-system.local",
          "X-Title": "School Management System",
        },
        body: JSON.stringify(buildOpenRouterRequestBody(args.buffer)),
      }),
      args.timeoutMs,
      () => undefined,
      "OpenRouter OCR fallback timed out"
    );

    if (!response.ok) {
      if (response.status === 429) {
        return {
          kind: "rate_limited",
          errorMessage:
            "OpenRouter OCR fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF.",
        };
      }

      const errorText = await response.text().catch(() => "");
      let providerMessage = errorText;
      try {
        const payload = JSON.parse(errorText) as { error?: { message?: string; metadata?: { raw?: string } } };
        providerMessage = payload.error?.metadata?.raw || payload.error?.message || errorText;
      } catch {
        providerMessage = errorText;
      }

      return {
        kind: "error",
        errorMessage: `OpenRouter OCR fallback request failed with HTTP ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 500)}` : ""}`,
      };
    }

    const payload = (await response.json()) as unknown;
    const text = parseOpenRouterTextResponse(payload);
    if (!text) {
      return {
        kind: "empty",
        errorMessage: "OpenRouter OCR fallback returned no readable text",
      };
    }

    return {
      kind: "success",
      text,
    };
  } catch (error) {
    return {
      kind: "error",
      errorMessage: error instanceof Error ? error.message : "OpenRouter OCR fallback failed",
    };
  }
}

function buildResultFromQuality(args: {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  pageCount?: number;
  errorMessage: string | null;
  extractionPath: "parser" | "openrouter" | "plain_text" | "none";
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
}): KnowledgeMaterialTextExtractionResult {
  return args;
}

function buildUnavailableFallbackResult(args: {
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
  status: "ready" | "ocr_needed" | "failed";
}): KnowledgeMaterialTextExtractionResult {
  const errorMessage =
    args.fallbackReason === "scanned_or_problematic"
      ? "This PDF appears scanned or image-only. OCR is still needed because OpenRouter OCR fallback is not configured in this environment."
      : args.fallbackReason === "unreadable_text"
        ? "The PDF text was unreadable after native extraction, and OCR is still needed because OpenRouter OCR fallback is not configured in this environment."
        : "Native PDF parsing failed, and OpenRouter OCR fallback is not configured in this environment.";

  return buildResultFromQuality({
    status: args.status,
    text: "",
    errorMessage,
    extractionPath: "none",
    fallbackReason: args.fallbackReason,
  });
}

function buildRateLimitedFallbackResult(args: {
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
  status: "ready" | "ocr_needed" | "failed";
}): KnowledgeMaterialTextExtractionResult {
  const errorMessage =
    args.fallbackReason === "scanned_or_problematic" || args.fallbackReason === "unreadable_text"
      ? "This PDF still needs OCR, but OpenRouter OCR fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF."
      : "Native PDF parsing failed, and OpenRouter OCR fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF.";

  return buildResultFromQuality({
    status: args.status,
    text: "",
    errorMessage,
    extractionPath: "none",
    fallbackReason: args.fallbackReason,
  });
}

export async function extractReadableTextFromBuffer(
  buffer: Buffer,
  options: KnowledgeMaterialTextExtractionOptions = {}
): Promise<KnowledgeMaterialTextExtractionResult> {
  const isPdf = isPdfLikeBuffer(buffer, options.contentType);

  if (!isPdf) {
    const decoded = new TextDecoder().decode(buffer);
    const quality = evaluateTextQuality(decoded);

    if (quality.adequate) {
      return buildResultFromQuality({
        status: "ready",
        text: quality.normalizedText,
        errorMessage: null,
        extractionPath: "plain_text",
        fallbackReason: "none",
      });
    }

    return buildResultFromQuality({
      status: "failed",
      text: quality.normalizedText,
      errorMessage: quality.normalizedText
        ? "The uploaded text file contained unreadable or insufficient text to index."
        : "The uploaded text file did not contain enough readable text to index.",
      extractionPath: "plain_text",
      fallbackReason: quality.readable ? "insufficient_text" : "unreadable_text",
    });
  }

  const parserResult = await parsePdfBuffer(buffer, {
    timeoutMs: options.pdfParseTimeoutMs ?? DEFAULT_PDF_PARSE_TIMEOUT_MS,
    selectedPageNumbers: options.selectedPageNumbers,
  });

  if (parserResult.kind === "page_limit") {
    return buildResultFromQuality({
      status: "failed",
      text: "",
      errorMessage: `This PDF exceeds the ${MAX_KNOWLEDGE_MATERIAL_PDF_PAGES}-page limit for the planning library.`,
      extractionPath: "none",
      fallbackReason: "insufficient_text",
    });
  }

  if (parserResult.kind === "error") {
    const openRouterApiKey = options.openRouterApiKey?.trim();

    if (!openRouterApiKey) {
      return buildUnavailableFallbackResult({
        fallbackReason: "parser_error",
        status: "failed",
      });
    }

    const openRouterResult = await extractPdfTextWithOpenRouter({
      buffer,
      apiKey: openRouterApiKey,
      fetchImpl: options.fetchImpl ?? fetch,
      timeoutMs: options.openRouterTimeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS,
      selectedPageNumbers: options.selectedPageNumbers,
    });

    if (openRouterResult.kind === "success") {
      const quality = evaluateTextQuality(openRouterResult.text);
      if (quality.adequate) {
        return buildResultFromQuality({
          status: "ready",
          text: quality.normalizedText,
          errorMessage: null,
          extractionPath: "openrouter",
          fallbackReason: "none",
        });
      }

      return buildResultFromQuality({
        status: "failed",
        text: quality.normalizedText,
        errorMessage: "OpenRouter OCR fallback returned text that was still too short to index.",
        extractionPath: "openrouter",
        fallbackReason: "insufficient_text",
      });
    }

    if (openRouterResult.kind === "rate_limited") {
      return buildRateLimitedFallbackResult({
        fallbackReason: "parser_error",
        status: "failed",
      });
    }

    return buildResultFromQuality({
      status: "failed",
      text: "",
      errorMessage: openRouterResult.errorMessage,
      extractionPath: "openrouter",
      fallbackReason: "parser_error",
    });
  }

  const quality = parserResult.quality;
  if (quality.adequate) {
    return buildResultFromQuality({
      status: "ready",
      text: quality.normalizedText,
      pages: parserResult.pages,
      pageCount: parserResult.pageCount,
      errorMessage: null,
      extractionPath: "parser",
      fallbackReason: "none",
    });
  }

  const fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"] =
    quality.normalizedText.length === 0
      ? "scanned_or_problematic"
      : !quality.readable
        ? "unreadable_text"
        : "insufficient_text";

  if (fallbackReason === "insufficient_text") {
    return buildResultFromQuality({
      status: "failed",
      text: quality.normalizedText,
      pages: parserResult.pages,
      pageCount: parserResult.pageCount,
      errorMessage:
        "The PDF text was readable but too short to index. Please upload a fuller PDF or a different source.",
      extractionPath: "parser",
      fallbackReason,
    });
  }

  const openRouterApiKey = options.openRouterApiKey?.trim();
  if (!openRouterApiKey) {
    return buildUnavailableFallbackResult({
      fallbackReason,
      status: "ocr_needed",
    });
  }

  const openRouterResult = await extractPdfTextWithOpenRouter({
    buffer,
    apiKey: openRouterApiKey,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.openRouterTimeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS,
    selectedPageNumbers: options.selectedPageNumbers,
  });

  if (openRouterResult.kind === "success") {
    const openRouterQuality = evaluateTextQuality(openRouterResult.text);
    if (openRouterQuality.adequate) {
      return buildResultFromQuality({
        status: "ready",
        text: openRouterQuality.normalizedText,
        errorMessage: null,
        extractionPath: "openrouter",
        fallbackReason: "none",
      });
    }

    return buildResultFromQuality({
      status: "ocr_needed",
      text: openRouterQuality.normalizedText,
      errorMessage: "OpenRouter OCR fallback returned text that was still too short to index.",
      extractionPath: "openrouter",
      fallbackReason,
    });
  }

  if (openRouterResult.kind === "rate_limited") {
    return buildRateLimitedFallbackResult({
      fallbackReason,
      status: "ocr_needed",
    });
  }

  return buildResultFromQuality({
    status: "ocr_needed",
    text: quality.normalizedText,
    errorMessage:
      openRouterResult.kind === "empty"
        ? openRouterResult.errorMessage
        : `OpenRouter OCR fallback failed: ${openRouterResult.errorMessage}`,
    extractionPath: "openrouter",
    fallbackReason,
  });
}
