"use node";

import type { TextContent } from "pdfjs-dist/types/src/display/api";
import {
  MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  assertPdfPageSelectionWithinLimit,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialText,
} from "./lessonKnowledgeIngestionHelpers";

const DEFAULT_PDF_PARSE_TIMEOUT_MS = 20_000;
const DEFAULT_PDF_PAGE_TEXT_TIMEOUT_MS = 3_000;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfWorkerModule = { WorkerMessageHandler: unknown };
let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsWorkerModulePromise: Promise<PdfWorkerModule> | null = null;

function ensurePdfJsGlobals() {
  const globalPdfJs = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  if (!globalPdfJs.DOMMatrix) globalPdfJs.DOMMatrix = class DOMMatrix { } as unknown as typeof DOMMatrix;
  if (!globalPdfJs.ImageData) globalPdfJs.ImageData = class ImageData { } as unknown as typeof ImageData;
  if (!globalPdfJs.Path2D) globalPdfJs.Path2D = class Path2D { } as unknown as typeof Path2D;
}

async function ensurePdfJsWorkerHandler() {
  // @ts-expect-error pdfjs-dist does not ship type declarations for the worker bundle.
  pdfJsWorkerModulePromise ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const workerModule = await pdfJsWorkerModulePromise;
  const globalPdfJs = globalThis as typeof globalThis & { pdfjsWorker?: { WorkerMessageHandler?: PdfWorkerModule["WorkerMessageHandler"] } };
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
  | { kind: "success"; text: string; pages: Array<{ pageNumber: number; text: string }>; quality: PdfQuality; pageCount: number }
  | { kind: "page_limit"; pageCount: number }
  | { kind: "error"; pageCount: number; errorMessage: string };

export type KnowledgeMaterialTextExtractionResult = {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  pageCount?: number;
  errorMessage: string | null;
  extractionPath: "parser" | "plain_text" | "none";
  fallbackReason:
  | "none"
  | "parser_error"
  | "scanned_or_problematic"
  | "unreadable_text"
  | "insufficient_text";
};

export type KnowledgeMaterialTextExtractionOptions = {
  contentType?: string | null;
  pdfParseTimeoutMs?: number;
  selectedPageNumbers?: number[];
  /** @deprecated OpenRouter PDF OCR is no longer used; retained for test/backward-call compatibility. */
  openRouterApiKey?: string | null;
  /** @deprecated OpenRouter PDF OCR is no longer used; retained for test/backward-call compatibility. */
  fetchImpl?: typeof fetch;
  /** @deprecated OpenRouter PDF OCR is no longer used; retained for test/backward-call compatibility. */
  openRouterTimeoutMs?: number;
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

function buildResultFromQuality(args: {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  pageCount?: number;
  errorMessage: string | null;
  extractionPath: "parser" | "plain_text" | "none";
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
}): KnowledgeMaterialTextExtractionResult {
  return args;
}

function buildOcrNeededResult(args: {
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
  status: "ocr_needed" | "failed";
  pageCount?: number;
}): KnowledgeMaterialTextExtractionResult {
  const errorMessage =
    args.fallbackReason === "scanned_or_problematic"
      ? "This PDF appears scanned or image-only. Provider-backed OCR is needed before it can be indexed."
      : args.fallbackReason === "unreadable_text"
        ? "The PDF text was unreadable after native extraction. Provider-backed OCR is needed before it can be indexed."
        : "Native PDF parsing failed. Provider-backed OCR is needed before this PDF can be indexed.";

  return buildResultFromQuality({
    status: args.status,
    text: "",
    ...(args.pageCount !== undefined ? { pageCount: args.pageCount } : {}),
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
    return buildOcrNeededResult({
      fallbackReason: "parser_error",
      status: "failed",
      pageCount: parserResult.pageCount,
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

  return buildOcrNeededResult({
    fallbackReason,
    status: "ocr_needed",
    pageCount: parserResult.pageCount,
  });
}
