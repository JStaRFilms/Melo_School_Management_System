# Reliable Scanned PDF OCR Fallback

## Status

Implemented for MVP (2026-05-02). Convex now owns OCR job state and queues OpenRouter PDF processing with the explicit `mistral-ocr` engine for stored PDFs from the teacher planning library.

## Goal

Make scanned and image-heavy teacher planning-library PDFs reliable to index without asking teachers to re-upload files that already exist in Convex storage. Digital PDFs should continue using native text extraction first. When native extraction cannot produce enough usable text, the system should queue a provider-backed OCR job, preserve tenant boundaries, store page-aware chunks, and fail gracefully.

## Decision

Use Convex as the source of truth and orchestration layer, with OpenRouter as the API gateway and its `file-parser` plugin pinned to the `mistral-ocr` PDF engine for MVP OCR.

Convex owns:

- Material records, source storage references, page selections, statuses, chunks, and audit logs.
- Auth, school membership checks, role checks, rate limits, retry limits, and provider configuration.
- Job state transitions, storage-aware job reuse, and idempotent chunk replacement.

OpenRouter PDF processing owns:

- Scanned/image-heavy PDF OCR.
- Page-level text/markdown extraction.

Do not put native canvas, Poppler, Tesseract, or other native PDF rendering packages inside Convex. Do not rely on the old free OpenRouter/Gemma `cloudflare-ai` PDF parsing path as the primary scanned-PDF OCR path. Do not make browser-side PDF rendering the primary path because it cannot reliably retry existing stored PDFs.

## Current State

The planning library currently supports file uploads, native PDF text extraction, selected page ranges, page-aware chunk metadata, and `ocr_needed` status. Recent attempts added free OpenRouter/Gemma PDF parsing and browser-prepared OCR retry, but those paths are unreliable for production:

- Free OpenRouter/Gemma plus `cloudflare-ai` parsing can return inconsistent OCR text, loses robust page boundaries, and is hard to audit.
- Browser-side rendering requires the teacher to select the original PDF again and depends on device/browser quality.
- Convex cannot safely bundle native canvas/PDF rasterization modules.

## Components

### Client

- `/planning/library` shows material status and retry actions.
- Teachers can run provider OCR for `ocr_needed` materials without re-uploading.
- Normal failed/stale extraction retries still use the native ingestion retry pipeline.
- UI shows selected-page summaries and safe failure messages.
- Browser-side OCR preparation is no longer used by the primary teacher retry flow.

### Convex Backend

- Native extraction remains first pass for digital PDFs and text files.
- `knowledgeOcrJobs` tracks scanned/image-heavy PDF OCR attempts.
- `requestKnowledgeMaterialProviderOcr` validates staff access, school boundary, rate limits, retry caps, stored-file availability, and idempotent queued jobs.
- OCR job reuse is only valid when the queued/processing job still points at the material's current `storageId`; stale jobs from a replaced trimmed PDF are ignored.
- `lessonKnowledgeOcrActions.processKnowledgeMaterialOcrJobInternal` calls OpenRouter chat completions with a short-lived Convex storage URL and the `file-parser` plugin configured as `engine: "mistral-ocr"`.
- Provider requests use abortable timeouts so timed-out OpenRouter calls are actively cancelled.
- Internal mutations transition jobs through queued -> processing -> succeeded/failed and write audit events.
- OCR results are normalized to pages and chunked with page metadata.

### Provider Layer

- MVP provider: OpenRouter via `OPENROUTER_API_KEY`, using `OPENROUTER_PDF_ENGINE=mistral-ocr`.
- `OPENROUTER_OCR_MODEL` can override the model that receives the parsed PDF; otherwise the code uses the project default.
- Internal adapter normalizes provider output into pages:
  - `pageNumber`
  - `text`
  - optional `markdown`
  - optional `confidence`
  - optional provider metadata
- Future providers can include Azure Document Intelligence, Google Document AI, AWS Textract, or an external worker.

## Data Flow

1. Teacher uploads a PDF or retries an existing material.
2. Convex stores or reuses the material `storageId` and selected page metadata.
3. Native extraction runs first.
4. If native text is adequate, chunks are written and the material becomes `ready`.
5. If native text is empty/unreadable/image-heavy, material becomes `ocr_needed`.
6. Teacher or admin queues OCR.
7. Convex validates auth, school membership, material ownership/management rights, retry limits, and school quota.
8. Convex creates an OCR job and marks the material OCR queued/processing.
9. Convex Node action fetches the stored file via `ctx.storage.getUrl(storageId)` and calls OpenRouter PDF processing with `mistral-ocr`.
10. OCR pages are normalized and saved or chunked.
11. Existing chunks for the material are replaced idempotently.
12. Chunks preserve `pageStart`, `pageEnd`, and `pageNumbers`.
13. Material becomes `ready`, or `ocr_failed`/`failed` with a safe retryable error.

## Database Schema Direction

Add a dedicated OCR job/attempt table unless the implementer confirms an existing table cleanly covers the same responsibility.

Required OCR job fields:

- `schoolId`
- `materialId`
- `storageId`
- `requestedByUserId`
- `provider`
- `status`: `queued`, `processing`, `succeeded`, `failed`, `cancelled`
- `attempt`
- `maxAttempts`
- `selectedPageRanges`
- `selectedPageNumbers`
- `providerJobId`
- `errorCode`
- `errorMessage`
- `createdAt`
- `startedAt`
- `completedAt`

Material records should expose enough status for the teacher UI:

- `ocr_needed`
- OCR queued/processing state, either as new statuses or a clear mapping to existing `queued`/`extracting`
- `ready`
- retryable OCR failure

Chunk records must keep page metadata:

- `pageStart`
- `pageEnd`
- `pageNumbers`

Audit events should record OCR requested, queued, started, succeeded, failed, retried, and chunked.

## Security Model

- Derive identity server-side with Convex auth. Never accept `userId` from the client for authorization.
- Derive or validate school membership server-side for every write.
- All OCR jobs, chunks, and audit rows must include `schoolId`.
- Read/write OCR rows only after verifying the material belongs to the same school.
- Generate signed storage access only inside Convex actions or trusted workers.
- Never persist signed URLs.
- Store provider secrets only in Convex environment variables. MVP requires `OPENROUTER_API_KEY`, not `MISTRAL_API_KEY`.
- Normalize provider errors before storing or showing them.
- Rate limit OCR by school and material, with retry cooldown and max attempts.

## MVP Scope

- OpenRouter `file-parser` with `mistral-ocr` engine only.
- Convex Node action execution path.
- Manual teacher retry for existing `ocr_needed` materials.
- Optional admin/internal bulk queue task can be planned but does not need UI in MVP.
- Selected page ranges remain supported.
- Existing native extraction remains first pass.
- Free OpenRouter/Gemma `cloudflare-ai` parsing and browser-rendered OCR are no longer primary scanned-PDF OCR paths.

## Future Scope

- External OCR worker for preprocessing, batching, or provider fallback.
- Azure or Google fallback provider.
- OCR usage dashboard and billing/quota reporting.
- Confidence display and manual review for low-confidence pages.
- Table-aware chunking.
- Bulk admin retry UI.

## Acceptance Criteria

- Digital PDFs with embedded text still become `ready` through native extraction.
- Scanned/image-heavy PDFs become `ocr_needed` when native extraction is inadequate.
- Existing stored `ocr_needed` PDFs can be retried without re-uploading.
- OCR provider errors do not crash the app.
- Failed OCR attempts leave the material recoverable.
- Selected page ranges such as `1-5,7-8` are respected.
- Browser-prepared OCR page numbers must be unique, positive, and within the material's known PDF page count.
- Chunks include page metadata.
- Teachers cannot OCR materials from another school.
- Audit logs and retry limits are in place.
- No native canvas/PDF rasterization package is introduced inside Convex.

## Verification

Completed:

- `pnpm --filter @school/convex convex:codegen`
- `pnpm --filter @school/convex typecheck`
- `pnpm --filter teacher typecheck`
- `pnpm convex deploy` against the configured production Convex deployment

Still required before production release:

- Confirm `OPENROUTER_API_KEY` is configured in the target Convex deployment.
- Manual test digital PDF, scanned PDF, selected-page scanned PDF, corrupt PDF, provider timeout, and cross-school access.
