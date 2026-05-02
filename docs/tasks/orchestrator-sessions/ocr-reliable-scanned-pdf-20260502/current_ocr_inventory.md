# Current OCR Attempt Inventory

## Summary

The current implementation already has useful foundations: native PDF text extraction, selected-page range parsing, selected-page PDF trimming, page-aware chunk metadata, `ocr_needed` status, upload/finalize/retry mutations, and teacher-library status actions. The unreliable pieces are the experimental OpenRouter/Gemma fallback and the browser-prepared OCR retry flow.

## Current Native Extraction

- `lessonKnowledgeIngestionActions.ts` fetches uploaded files from Convex storage and calls `extractReadableTextFromBuffer`.
- `lessonKnowledgePdfExtraction.ts` uses `pdfjs-dist` in a Node action to extract selectable text from PDFs.
- Text quality is checked with readability and minimum-content thresholds.
- Digital PDFs can produce page-level text and then page-aware chunks.

## Current Selected-Page Behavior

- `lessonKnowledgeIngestionHelpers.ts` parses page ranges like `1-5,7-8`.
- `lessonKnowledgeIngestionActions.ts` uses `pdf-lib` to build a selected-pages PDF when `selectedPageNumbers` exist and `sourceFileMode` is not already `selected_pages`.
- The selected-pages PDF can replace the material storage reference internally.
- `knowledgeMaterialChunks` already supports `pageStart`, `pageEnd`, and `pageNumbers`.

## Current OpenRouter/Gemma Fallback

- `lessonKnowledgePdfExtraction.ts` calls OpenRouter chat completions with `google/gemma-4-31b-it:free`.
- The request uses the `file-parser` plugin with `cloudflare-ai`.
- It returns a plain text response, not a robust normalized page model.
- Failures are converted to `ocr_needed` or `failed`, but provider behavior is not reliable enough for primary OCR.

## Current Browser-Prepared OCR Retry

- `apps/teacher/app/planning/library/page.tsx` imports `renderPdfPagesToOcrImages`.
- When a material is `ocr_needed`, the teacher is prompted to choose the original PDF locally.
- The browser renders pages to JPEG, uploads the page images, and calls `lessonKnowledgeBrowserOcrActions`.
- This path does not satisfy existing stored-file retry because the teacher must provide the file again.

## Current Public Entry Points

- `requestKnowledgeMaterialUploadUrl`
- `finalizeKnowledgeMaterialUpload`
- `retryKnowledgeMaterialIngestion`
- `requestKnowledgeMaterialBrowserOcrImageUploadUrls`
- Browser-prepared OCR action under `lessonKnowledgeBrowserOcrActions`

## Keep

- Native PDF text extraction as first pass.
- Selected-page parsing and validation.
- Selected-page PDF trimming if it remains compatible with provider OCR.
- Page-aware chunk metadata.
- Existing tenant-aware material management checks.

## Replace or Downgrade

- Replace OpenRouter/Gemma as primary scanned-PDF OCR fallback with Mistral OCR.
- Replace browser-first retry UX with server-side OCR retry from stored Convex files.
- Keep browser OCR only as a hidden/manual last-resort fallback if product still wants it.

## Implementation Risks

- Current status enum only has `awaiting_upload`, `queued`, `extracting`, `ocr_needed`, `ready`, and `failed`; design must decide whether to add OCR-specific statuses or map OCR jobs onto existing values.
- Existing chunk replacement loops must stay within Convex transaction limits for larger documents.
- Selected-page storage replacement means some materials may store trimmed PDFs rather than originals; retry behavior must handle both `original` and `selected_pages` source modes.
- Provider errors must be normalized so raw provider responses and secrets never leak to teachers or audit logs.
- Rate limits and retry caps must be enforced before enabling bulk retry.
