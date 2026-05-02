# Reliable Scanned PDF OCR Fallback

## Status

Accepted for Takomi implementation planning.

## Goal

Make scanned and image-heavy teacher planning-library PDFs reliable to index without asking teachers to re-upload files that already exist in Convex storage. Digital PDFs should continue using native text extraction first. When native extraction cannot produce enough usable text, the system should queue a provider-backed OCR job, preserve tenant boundaries, store page-aware chunks, and fail gracefully.

## Decision

Use Convex as the source of truth and orchestration layer, with Mistral OCR as the MVP OCR provider.

Convex owns:

- Material records, source storage references, page selections, statuses, chunks, and audit logs.
- Auth, school membership checks, role checks, rate limits, retry limits, and provider configuration.
- Job state transitions and idempotent chunk replacement.

Mistral OCR owns:

- Scanned/image-heavy PDF OCR.
- Page-level text/markdown extraction.

Do not put native canvas, Poppler, Tesseract, or other native PDF rendering packages inside Convex. Do not rely on OpenRouter/Gemma PDF parsing as the primary OCR path. Do not make browser-side PDF rendering the primary path because it cannot reliably retry existing stored PDFs.

## Current State

The planning library currently supports file uploads, native PDF text extraction, selected page ranges, page-aware chunk metadata, and `ocr_needed` status. Recent attempts added OpenRouter/Gemma fallback and browser-prepared OCR retry, but those paths are unreliable for production:

- OpenRouter/Gemma can return inconsistent OCR text, loses robust page boundaries, and is hard to audit.
- Browser-side rendering requires the teacher to select the original PDF again and depends on device/browser quality.
- Convex cannot safely bundle native canvas/PDF rasterization modules.

## Components

### Client

- `/planning/library` shows material status and retry actions.
- Teachers can run OCR for `ocr_needed` or retryable failed materials without re-uploading.
- UI shows selected-page summaries and safe failure messages.
- Browser-side OCR preparation should be removed from the primary flow or kept only as a hidden emergency fallback.

### Convex Backend

- Native extraction remains first pass for digital PDFs and text files.
- OCR job/attempt tracking is added for scanned/image-heavy PDFs.
- A Node action calls the configured OCR provider using a short-lived storage URL or fetched file bytes.
- Mutations validate school/role access and persist normalized OCR results.
- Chunking remains page-aware and selected-page-aware.

### Provider Layer

- MVP provider: Mistral OCR.
- Internal adapter shape should normalize provider output into pages:
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
9. Convex Node action fetches the stored file via `ctx.storage.getUrl(storageId)` and calls Mistral OCR.
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
- Store provider secrets only in Convex environment variables.
- Normalize provider errors before storing or showing them.
- Rate limit OCR by school and material, with retry cooldown and max attempts.

## MVP Scope

- Mistral OCR provider only.
- Convex Node action execution path.
- Manual teacher retry for existing `ocr_needed` materials.
- Optional admin/internal bulk queue task can be planned but does not need UI in MVP.
- Selected page ranges remain supported.
- Existing native extraction remains first pass.
- OpenRouter/Gemma and browser-rendered OCR are no longer primary paths.

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
- Chunks include page metadata.
- Teachers cannot OCR materials from another school.
- Audit logs and retry limits are in place.
- No native canvas/PDF rasterization package is introduced inside Convex.

## Verification

- Run `pnpm typecheck` after implementation.
- Run targeted Convex tests for auth, retry limits, page ranges, and chunking if available.
- Manually test digital PDF, scanned PDF, selected-page scanned PDF, corrupt PDF, provider timeout, and cross-school access.
- Run `pnpm convex deploy` after Convex implementation work, per project policy.
