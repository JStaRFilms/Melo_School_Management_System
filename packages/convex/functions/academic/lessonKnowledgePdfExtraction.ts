"use node";

import type { TextContent } from "pdfjs-dist/types/src/display/api";
import {
  MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialText,
} from "./lessonKnowledgeIngestionHelpers";

const GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_PDF_PARSE_TIMEOUT_MS = 20_000;
const DEFAULT_GEMINI_TIMEOUT_MS = 20_000;

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

type GeminiFallbackOutcome =
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
  errorMessage: string | null;
  extractionPath: "parser" | "gemini" | "plain_text" | "none";
  fallbackReason:
  | "none"
  | "parser_error"
  | "scanned_or_problematic"
  | "unreadable_text"
  | "insufficient_text";
};

export type KnowledgeMaterialTextExtractionOptions = {
  contentType?: string | null;
  geminiApiKey?: string | null;
  fetchImpl?: typeof fetch;
  pdfParseTimeoutMs?: number;
  geminiTimeoutMs?: number;
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

async function parsePdfBuffer(buffer: Buffer, timeoutMs: number): Promise<PdfParserOutcome> {
  const { getDocument } = await getPdfJsModule();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });

  try {
    const documentProxy = await withTimeout(
      loadingTask.promise,
      timeoutMs,
      () => {
        void loadingTask.destroy();
      },
      "PDF parsing timed out"
    );

    const pageCount = documentProxy.numPages;
    if (pageCount > MAX_KNOWLEDGE_MATERIAL_PDF_PAGES) {
      return {
        kind: "page_limit",
        pageCount,
      };
    }

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = getTextFromContent(textContent);
      if (pageText) {
        pageTexts.push(pageText);
      }

      const currentQuality = evaluateTextQuality(pageTexts.join("\n\n"));
      if (currentQuality.adequate) {
        return {
          kind: "success",
          text: currentQuality.normalizedText,
          quality: currentQuality,
          pageCount,
        };
      }
    }

    const quality = evaluateTextQuality(pageTexts.join("\n\n"));
    return {
      kind: "success",
      text: quality.normalizedText,
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

function buildGeminiRequestBody(buffer: Buffer) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Extract the visible text from this school PDF. Return only the text, preserve headings and line breaks, and do not summarize or add commentary.",
          },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192,
    },
  };
}

function parseGeminiTextResponse(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    return "";
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") {
      continue;
    }

    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    const text = parts
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

  return "";
}

async function extractPdfTextWithGemini(args: {
  buffer: Buffer;
  apiKey: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<GeminiFallbackOutcome> {
  try {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    url.searchParams.set("key", args.apiKey);

    const response = await withTimeout(
      args.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildGeminiRequestBody(args.buffer)),
      }),
      args.timeoutMs,
      () => undefined,
      "Gemini fallback timed out"
    );

    if (!response.ok) {
      if (response.status === 429) {
        return {
          kind: "rate_limited",
          errorMessage:
            "Gemini fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF.",
        };
      }

      return {
        kind: "error",
        errorMessage: `Gemini fallback request failed with HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as unknown;
    const text = parseGeminiTextResponse(payload);
    if (!text) {
      return {
        kind: "empty",
        errorMessage: "Gemini fallback returned no readable text",
      };
    }

    return {
      kind: "success",
      text,
    };
  } catch (error) {
    return {
      kind: "error",
      errorMessage: error instanceof Error ? error.message : "Gemini fallback timed out",
    };
  }
}

function buildResultFromQuality(args: {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  errorMessage: string | null;
  extractionPath: "parser" | "gemini" | "plain_text" | "none";
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
      ? "This PDF appears scanned or image-only. OCR is still needed because Gemini fallback is not configured in this environment."
      : args.fallbackReason === "unreadable_text"
        ? "The PDF text was unreadable after native extraction, and OCR is still needed because Gemini fallback is not configured in this environment."
        : "Native PDF parsing failed, and Gemini fallback is not configured in this environment.";

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
      ? "This PDF still needs OCR, but Gemini fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF."
      : "Native PDF parsing failed, and Gemini fallback is temporarily rate-limited (HTTP 429). Please try again later or upload an OCR'd PDF.";

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

  const parserResult = await parsePdfBuffer(
    buffer,
    options.pdfParseTimeoutMs ?? DEFAULT_PDF_PARSE_TIMEOUT_MS
  );

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
    const geminiApiKey = options.geminiApiKey?.trim();

    if (!geminiApiKey) {
      return buildUnavailableFallbackResult({
        fallbackReason: "parser_error",
        status: "failed",
      });
    }

    const geminiResult = await extractPdfTextWithGemini({
      buffer,
      apiKey: geminiApiKey,
      fetchImpl: options.fetchImpl ?? fetch,
      timeoutMs: options.geminiTimeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS,
    });

    if (geminiResult.kind === "success") {
      const quality = evaluateTextQuality(geminiResult.text);
      if (quality.adequate) {
        return buildResultFromQuality({
          status: "ready",
          text: quality.normalizedText,
          errorMessage: null,
          extractionPath: "gemini",
          fallbackReason: "none",
        });
      }

      return buildResultFromQuality({
        status: "failed",
        text: quality.normalizedText,
        errorMessage: "Gemini fallback returned text that was still too short to index.",
        extractionPath: "gemini",
        fallbackReason: "insufficient_text",
      });
    }

    if (geminiResult.kind === "rate_limited") {
      return buildRateLimitedFallbackResult({
        fallbackReason: "parser_error",
        status: "failed",
      });
    }

    return buildResultFromQuality({
      status: "failed",
      text: "",
      errorMessage: geminiResult.errorMessage,
      extractionPath: "gemini",
      fallbackReason: "parser_error",
    });
  }

  const quality = parserResult.quality;
  if (quality.adequate) {
    return buildResultFromQuality({
      status: "ready",
      text: quality.normalizedText,
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
      errorMessage:
        "The PDF text was readable but too short to index. Please upload a fuller PDF or a different source.",
      extractionPath: "parser",
      fallbackReason,
    });
  }

  const geminiApiKey = options.geminiApiKey?.trim();
  if (!geminiApiKey) {
    return buildUnavailableFallbackResult({
      fallbackReason,
      status: "ocr_needed",
    });
  }

  const geminiResult = await extractPdfTextWithGemini({
    buffer,
    apiKey: geminiApiKey,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.geminiTimeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS,
  });

  if (geminiResult.kind === "success") {
    const geminiQuality = evaluateTextQuality(geminiResult.text);
    if (geminiQuality.adequate) {
      return buildResultFromQuality({
        status: "ready",
        text: geminiQuality.normalizedText,
        errorMessage: null,
        extractionPath: "gemini",
        fallbackReason: "none",
      });
    }

    return buildResultFromQuality({
      status: "ocr_needed",
      text: geminiQuality.normalizedText,
      errorMessage: "Gemini fallback returned text that was still too short to index.",
      extractionPath: "gemini",
      fallbackReason,
    });
  }

  if (geminiResult.kind === "rate_limited") {
    return buildRateLimitedFallbackResult({
      fallbackReason,
      status: "ocr_needed",
    });
  }

  return buildResultFromQuality({
    status: "ocr_needed",
    text: quality.normalizedText,
    errorMessage:
      geminiResult.kind === "empty"
        ? geminiResult.errorMessage
        : `Gemini fallback failed: ${geminiResult.errorMessage}`,
    extractionPath: "gemini",
    fallbackReason,
  });
}
