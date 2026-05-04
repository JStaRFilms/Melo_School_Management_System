"use node";

import mammoth from "mammoth";
import JSZip from "jszip";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import {
  MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  assertPdfPageSelectionWithinLimit,
  isKnowledgeMaterialImageContentType,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialContentType,
  normalizeKnowledgeMaterialText,
} from "./lessonKnowledgeIngestionHelpers";

const DEFAULT_PDF_PARSE_TIMEOUT_MS = 20_000;
const DEFAULT_PDF_PAGE_TEXT_TIMEOUT_MS = 3_000;
const DEFAULT_OFFICE_PARSE_TIMEOUT_MS = 15_000;
const MAX_OFFICE_ZIP_ENTRIES = 2_000;
const MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_DOCX_DOCUMENT_XML_BYTES = 8 * 1024 * 1024;
const MAX_PPTX_SLIDES = 150;
const MAX_PPTX_SLIDE_XML_BYTES = 1024 * 1024;
const MAX_PPTX_TOTAL_SLIDE_XML_BYTES = 8 * 1024 * 1024;

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
  if (!globalPdfJs.DOMMatrix) globalPdfJs.DOMMatrix = class DOMMatrix {} as unknown as typeof DOMMatrix;
  if (!globalPdfJs.ImageData) globalPdfJs.ImageData = class ImageData {} as unknown as typeof ImageData;
  if (!globalPdfJs.Path2D) globalPdfJs.Path2D = class Path2D {} as unknown as typeof Path2D;
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

type TextQuality = {
  normalizedText: string;
  letters: number;
  words: number;
  readable: boolean;
  adequate: boolean;
};

type PdfParserOutcome =
  | { kind: "success"; text: string; pages: Array<{ pageNumber: number; text: string }>; quality: TextQuality; pageCount: number }
  | { kind: "page_limit"; pageCount: number }
  | { kind: "error"; pageCount: number; errorMessage: string };

export type KnowledgeMaterialTextExtractionResult = {
  status: "ready" | "ocr_needed" | "failed";
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
  pageCount?: number;
  errorMessage: string | null;
  extractionPath: "parser" | "plain_text" | "docx" | "pptx" | "image" | "none";
  fallbackReason:
    | "none"
    | "parser_error"
    | "scanned_or_problematic"
    | "unreadable_text"
    | "insufficient_text"
    | "ocr_required_for_image";
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

function isPdfLikeBuffer(buffer: Buffer, contentType?: string | null) {
  const normalizedContentType = normalizeKnowledgeMaterialContentType(contentType);
  return normalizedContentType?.includes("pdf") || buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function isDocxContentType(contentType?: string | null) {
  return normalizeKnowledgeMaterialContentType(contentType) === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isPptxContentType(contentType?: string | null) {
  return normalizeKnowledgeMaterialContentType(contentType) === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
}

function isZipLikeBuffer(buffer: Buffer) {
  return buffer.subarray(0, 2).toString("latin1") === "PK";
}

function isMarkdownOrTextContentType(contentType?: string | null) {
  const normalized = normalizeKnowledgeMaterialContentType(contentType);
  return Boolean(normalized && normalized.startsWith("text/"));
}

function evaluateTextQuality(value: string): TextQuality {
  const normalizedText = normalizeKnowledgeMaterialText(value);
  const letters = (normalizedText.match(/[A-Za-z]/g) ?? []).length;
  const words = normalizedText ? normalizedText.split(/\s+/).length : 0;
  const readable = isLikelyReadableKnowledgeMaterialText(normalizedText);
  const adequate = readable && (words >= 20 || letters >= 120);

  return { normalizedText, letters, words, readable, adequate };
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void, timeoutMessage: string): Promise<T> {
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
      return { kind: "page_limit", pageCount };
    }

    const pageTexts: string[] = [];
    const pages: Array<{ pageNumber: number; text: string }> = [];
    const pagesToRead = selectedPageNumbers ?? Array.from({ length: pageCount }, (_, index) => index + 1);
    for (const pageNumber of pagesToRead) {
      if (remainingTimeoutMs() <= 1) break;

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
        // Preserve other extracted pages.
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
    return { kind: "success", text: quality.normalizedText, pages, quality, pageCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parsing failed";
    return { kind: "error", pageCount: 0, errorMessage: message };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

type ZipEntryWithPrivateData = JSZip.JSZipObject & {
  _data?: {
    compressedSize?: number;
    uncompressedSize?: number;
  };
};

function getZipEntryUncompressedSize(entry: JSZip.JSZipObject) {
  const size = (entry as ZipEntryWithPrivateData)._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

async function loadBoundedOfficeZip(buffer: Buffer) {
  if (!isZipLikeBuffer(buffer)) {
    throw new Error("Office document is not a valid ZIP-based DOCX/PPTX file.");
  }

  const zip = await withTimeout(
    JSZip.loadAsync(buffer),
    DEFAULT_OFFICE_PARSE_TIMEOUT_MS,
    () => undefined,
    "Office document parsing timed out"
  );
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_OFFICE_ZIP_ENTRIES) {
    throw new Error("Office document contains too many internal files to process safely.");
  }

  const knownTotalUncompressedBytes = entries.reduce((sum, entry) => sum + (getZipEntryUncompressedSize(entry) ?? 0), 0);
  if (knownTotalUncompressedBytes > MAX_OFFICE_TOTAL_UNCOMPRESSED_BYTES) {
    throw new Error("Office document expands beyond the safe processing limit.");
  }

  return zip;
}

async function extractDocxText(buffer: Buffer) {
  const zip = await loadBoundedOfficeZip(buffer);
  const documentEntry = zip.files["word/document.xml"];
  const documentXmlBytes = documentEntry ? getZipEntryUncompressedSize(documentEntry) : null;
  if (!documentEntry || (documentXmlBytes !== null && documentXmlBytes > MAX_DOCX_DOCUMENT_XML_BYTES)) {
    throw new Error("DOCX document body is missing or too large to process safely.");
  }

  const result = await withTimeout(
    mammoth.extractRawText({ buffer }),
    DEFAULT_OFFICE_PARSE_TIMEOUT_MS,
    () => undefined,
    "DOCX text extraction timed out"
  );
  return normalizeKnowledgeMaterialText(result.value);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractPptxPages(buffer: Buffer) {
  const zip = await loadBoundedOfficeZip(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return aNum - bNum;
    });

  if (slideEntries.length > MAX_PPTX_SLIDES) {
    throw new Error(`PPTX contains more than ${MAX_PPTX_SLIDES} slides and is too large to process safely.`);
  }

  const totalSlideXmlBytes = slideEntries.reduce((sum, entryName) => {
    const size = getZipEntryUncompressedSize(zip.files[entryName]);
    return sum + (size ?? 0);
  }, 0);
  if (totalSlideXmlBytes > MAX_PPTX_TOTAL_SLIDE_XML_BYTES) {
    throw new Error("PPTX slide text XML expands beyond the safe processing limit.");
  }

  const pages: Array<{ pageNumber: number; text: string }> = [];
  for (const [index, entryName] of slideEntries.entries()) {
    const entry = zip.files[entryName];
    const entrySize = getZipEntryUncompressedSize(entry);
    if (entrySize !== null && entrySize > MAX_PPTX_SLIDE_XML_BYTES) {
      throw new Error("A PPTX slide is too large to process safely.");
    }

    const xml = await withTimeout(
      entry.async("string"),
      DEFAULT_OFFICE_PARSE_TIMEOUT_MS,
      () => undefined,
      "PPTX slide extraction timed out"
    );
    const texts = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), (match) => decodeXmlEntities(match[1] ?? ""));
    const text = normalizeKnowledgeMaterialText(texts.join(" "));
    if (text) {
      pages.push({ pageNumber: index + 1, text });
    }
  }

  return pages;
}

function buildResult(args: KnowledgeMaterialTextExtractionResult): KnowledgeMaterialTextExtractionResult {
  return args;
}

function buildTextFileResult(text: string, extractionPath: "plain_text" | "docx" | "pptx") {
  const quality = evaluateTextQuality(text);
  if (quality.adequate) {
    return buildResult({
      status: "ready",
      text: quality.normalizedText,
      errorMessage: null,
      extractionPath,
      fallbackReason: "none",
    });
  }

  return buildResult({
    status: "failed",
    text: quality.normalizedText,
    errorMessage: quality.normalizedText
      ? "The uploaded file contained unreadable or insufficient text to index."
      : "The uploaded file did not contain enough readable text to index.",
    extractionPath,
    fallbackReason: quality.readable ? "insufficient_text" : "unreadable_text",
  });
}

function buildOcrNeededResult(args: {
  fallbackReason: KnowledgeMaterialTextExtractionResult["fallbackReason"];
  status: "ocr_needed" | "failed";
  pageCount?: number;
  errorMessage?: string;
}) {
  const errorMessage =
    args.errorMessage ??
    (args.fallbackReason === "scanned_or_problematic"
      ? "This PDF appears scanned or image-only. Provider-backed OCR is needed before it can be indexed."
      : args.fallbackReason === "unreadable_text"
        ? "The PDF text was unreadable after native extraction. Provider-backed OCR is needed before it can be indexed."
        : args.fallbackReason === "ocr_required_for_image"
          ? "Images require provider-backed OCR before they can be indexed."
          : "Native PDF parsing failed. Provider-backed OCR is needed before this PDF can be indexed.");

  return buildResult({
    status: args.status,
    text: "",
    ...(args.pageCount !== undefined ? { pageCount: args.pageCount } : {}),
    errorMessage,
    extractionPath: args.fallbackReason === "ocr_required_for_image" ? "image" : "none",
    fallbackReason: args.fallbackReason,
  });
}

export async function extractReadableTextFromBuffer(
  buffer: Buffer,
  options: KnowledgeMaterialTextExtractionOptions = {}
): Promise<KnowledgeMaterialTextExtractionResult> {
  const contentType = normalizeKnowledgeMaterialContentType(options.contentType);

  if (isKnowledgeMaterialImageContentType(contentType)) {
    return buildOcrNeededResult({
      fallbackReason: "ocr_required_for_image",
      status: "ocr_needed",
    });
  }

  if (isDocxContentType(contentType)) {
    return buildTextFileResult(await extractDocxText(buffer), "docx");
  }

  if (isPptxContentType(contentType)) {
    const pages = await extractPptxPages(buffer);
    const text = pages.map((page) => page.text).join("\n\n");
    const result = buildTextFileResult(text, "pptx");
    return result.status === "ready"
      ? { ...result, pages, pageCount: pages.length }
      : { ...result, pageCount: pages.length };
  }

  if (!isPdfLikeBuffer(buffer, contentType)) {
    if (!isMarkdownOrTextContentType(contentType)) {
      const decoded = new TextDecoder().decode(buffer);
      return buildTextFileResult(decoded, "plain_text");
    }

    const decoded = new TextDecoder().decode(buffer);
    return buildTextFileResult(decoded, "plain_text");
  }

  const parserResult = await parsePdfBuffer(buffer, {
    timeoutMs: options.pdfParseTimeoutMs ?? DEFAULT_PDF_PARSE_TIMEOUT_MS,
    selectedPageNumbers: options.selectedPageNumbers,
  });

  if (parserResult.kind === "page_limit") {
    return buildResult({
      status: "failed",
      text: "",
      errorMessage: `This PDF exceeds the ${MAX_KNOWLEDGE_MATERIAL_PDF_PAGES}-page limit for the planning library.`,
      extractionPath: "none",
      fallbackReason: "insufficient_text",
    });
  }

  if (parserResult.kind === "error") {
    return buildOcrNeededResult({ fallbackReason: "parser_error", status: "failed", pageCount: parserResult.pageCount });
  }

  const quality = parserResult.quality;
  if (quality.adequate) {
    return buildResult({
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
    return buildResult({
      status: "failed",
      text: quality.normalizedText,
      pages: parserResult.pages,
      pageCount: parserResult.pageCount,
      errorMessage: "The PDF text was readable but too short to index. Please upload a fuller PDF or a different source.",
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
