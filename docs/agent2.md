Now let me produce the architecture document as a well-structured, rendered artifact.Here is the full architecture review and implementation plan.

---

# OCR Pipeline Architecture — School Management SaaS

## 1. Why the Previous Approaches Failed

**OpenRouter/Gemma PDF parsing** treats PDFs as opaque blobs and asks a vision LLM to "read" the whole document in one shot. This is unreliable for three reasons: multipage documents exceed context windows silently, LLM providers quantize image quality before inference causing hallucinated characters, and there is no structured page-position output — you get a wall of text with no page boundary metadata, which breaks your page-range-aware chunking entirely.

**Browser-side canvas rendering (e.g. pdf.js + canvas screenshot)** works in demos but breaks in production because it runs on the teacher's device, meaning quality varies by browser version, hardware GPU, and OS font rendering. It also creates a significant upload-back problem: after rendering, you need to POST the rendered images back to your server or to the LLM, introducing a round-trip that fails under flaky Nigerian internet conditions. More importantly, canvas APIs are unavailable in Convex's V8 isolate and in your Next.js edge runtime.

**`@napi-rs/canvas` and native `.node` modules** fail entirely because Convex bundles to pure JavaScript/V8 — native Node addons do not load, full stop.

---

## 2. Recommended Primary Architecture: Convex Action → Mistral OCR API

**The core pattern is simple:** Convex stores the file and owns all state. A Convex `action` (which runs in a full Node.js environment with unrestricted outbound HTTP) fetches a short-lived signed download URL from Convex storage, streams the PDF bytes directly to Mistral's OCR endpoint, receives structured page-level JSON, and calls a mutation to persist chunks. Convex never touches a canvas.

**Why Mistral OCR over the alternatives:**

Mistral's dedicated OCR API (`mistral-ocr-latest`) is designed specifically for document ingestion at scale. It accepts raw PDF bytes, returns structured Markdown per page with bounding box metadata, supports page selection, and costs approximately $1 per 1,000 pages — significantly cheaper than Google Document AI ($1.50/page for the first tier) and Azure Document Intelligence. Google Document AI and AWS Textract are operationally heavier: they require provisioning processors, IAM roles, and GCS/S3 bucket intermediaries before a single byte flows. For an MVP on a lean stack, that operational cost is not justified.

An external Tesseract/Poppler worker is technically viable but requires you to run and maintain a containerized service (Cloud Run, Railway, Fly.io), implement your own auth layer, queue failed retries, handle cold starts, and pay for persistent compute. This is the right long-term option for very high volume but is overbuilt for MVP.

OpenRouter vision models remain an option for a fallback tier (image-heavy slides where OCR character-recognition fails but visual description is enough), not as the primary path.

---

## 3. Exact Data Flow

**New upload path:**

1. Teacher selects a PDF in `/planning/library`. The Next.js route handler calls `generateUploadUrl` on Convex, uploads the file bytes directly to Convex storage, and receives a `storageId`.
2. The frontend calls the `ingestMaterial` Convex mutation with `{ storageId, schoolId, teacherId, pageRange?, filename }`. The mutation creates a `materials` record with `status: "processing"` and immediately calls `ctx.scheduler.runAfter(0, internal.academic.lessonKnowledgeIngestionActions.processOcr, { materialId })`.
3. The `processOcr` Convex action wakes up, calls `ctx.storage.getUrl(storageId)` to get a short-lived signed URL (valid for ~1 minute, never persisted or logged), fetches the PDF bytes, and POSTs them to `https://api.mistral.ai/v1/ocr` with `{ model: "mistral-ocr-latest", pages: pageRange ?? null }`.
4. Mistral returns `{ pages: [{ index, markdown, bbox_data }] }`. The action iterates pages and calls `saveOcrChunks` mutation, writing one `lessonKnowledgeChunk` record per page with `{ materialId, pageIndex, text, schoolId }`.
5. The action calls `setMaterialStatus` mutation with `status: "ready"`. On any HTTP error or timeout, it calls `setMaterialStatus` with `status: "failed"` and writes an `ocrAuditLog` entry containing `{ materialId, schoolId, error, provider: "mistral", attemptedAt }`.
6. The library UI reactively updates via Convex's live query subscription — the teacher sees the status badge flip from processing to ready with no polling.

**Retry path for existing `ocr_needed` files:**

No re-upload required. The teacher clicks "Retry OCR" in the UI, which calls `triggerOcrRetry` mutation passing `materialId`. This mutation verifies the calling user belongs to the material's `schoolId` (tenant check), resets status to `"processing"`, and re-schedules `processOcr` with the same `storageId` already in the material record. Convex fetches a fresh signed URL at action runtime.

---

## 4. Convex Functions Required

**Mutations:**
- `ingestMaterial` — creates material record, validates schoolId, schedules OCR action
- `saveOcrChunks` — bulk-inserts chunk records, idempotent by `(materialId, pageIndex)` to handle retries cleanly
- `setMaterialStatus` — updates material status and writes audit log entry
- `triggerOcrRetry` — tenant-checked retry entry point called from frontend

**Actions:**
- `processOcr` — fetches signed URL, calls Mistral, invokes mutations; never writes directly to DB (actions cannot, by Convex design)
- `generateMaterialUploadUrl` — thin wrapper around `ctx.storage.generateUploadUrl` with schoolId validation

**Queries:**
- `getMaterialsBySchool` — paginated list query filtered by `schoolId`, returns status, filename, chunkCount
- `getChunksByMaterial` — for the planning library detail view and downstream search/RAG

**Internal helpers (not exposed to frontend):**
- `buildOcrPayload` — constructs the Mistral request body, handles page range slicing
- `parseOcrResponse` — maps Mistral page JSON to your chunk schema

---

## 5. Frontend UX Changes

The library page at `/planning/library` needs three additions:

**Status badge per material card.** Map the four statuses to readable states: `ready` → green "Indexed", `processing` → amber spinner "Processing…", `ocr_needed` → yellow "OCR Pending", `failed` → red "OCR Failed". These should use your existing design system tokens and update reactively without refresh.

**Retry button for `failed` and `ocr_needed` materials.** Visible only to the teacher who owns the material (or to school admins). Clicking it calls `triggerOcrRetry` and immediately transitions the badge to "Processing…". Disable the button during inflight to prevent double-triggers.

**Upload progress indication.** The current flow likely shows nothing after file selection. Add an intermediate "Uploading…" state before the Convex mutation is called, then transition to "Processing…" once the mutation confirms the record was created.

No re-upload UI is needed for existing failed files — this is the key teacher experience win.

---

## 6. Security Considerations

**Auth.** All mutations and the retry action must call `ctx.auth.getUserIdentity()` and verify the returning `subject` maps to a user record with membership in the material's `schoolId`. Do not pass `schoolId` as a trusted client parameter for write operations — derive it from the authenticated session on the server.

**Signed URLs.** `ctx.storage.getUrl(storageId)` returns a short-lived URL (typically 1 hour in Convex). The `processOcr` action should fetch this URL and use it immediately, never storing it in the database or logs. The `ocrAuditLog` table should store only `storageId`, not the signed URL.

**Tenant boundaries.** Every DB query and mutation must include a `schoolId` filter derived from server-side auth. The `saveOcrChunks` mutation should assert that the `materialId` being written to belongs to the same `schoolId` as the calling user before inserting any chunk records.

**Mistral API key.** Store as a Convex environment variable (`MISTRAL_API_KEY`), accessed only inside the action via `process.env`. Never reference it in mutations, queries, or client-side code.

**Rate limits.** Mistral's OCR API has per-minute and per-day rate limits (check their dashboard for your tier). Implement a simple exponential backoff inside `processOcr`: on HTTP 429, reschedule via `ctx.scheduler.runAfter(delay, ...)` with doubling delay up to a max of 10 minutes. Track attempt count in the material record and fail permanently after 5 attempts, writing a clear audit log entry.

**Audit logs.** The `ocrAuditLog` table should be write-only for the application and readable only by school admin roles. Log: materialId, schoolId, provider, status (success/failure), page count processed, error message if any, timestamp. This gives you a paper trail for debugging and for billing reconciliation.

---

## 7. Cost and Performance

At Mistral's current pricing (~$1/1,000 pages), a school that uploads 500 planning documents per year averaging 8 pages each equals 4,000 pages, costing approximately $4/school/year for OCR alone. This is negligible relative to SaaS pricing. Costs only apply to scanned/image PDFs; native digital PDFs continue to extract for free via your existing pipeline.

Performance-wise, Mistral OCR processes approximately 5–15 pages per second depending on document density. A 20-page scanned worksheet should complete in 2–4 seconds. The Convex action timeout limit (currently 10 minutes) is more than sufficient. For very large documents (100+ pages), consider splitting into 50-page batches scheduled as separate actions to stay well under the timeout and allow partial progress.

The async architecture means teachers are never blocked waiting — they upload and move on, returning to find their document indexed.

---

## 8. Migration and Cleanup Plan

**Phase 1 — deploy new pipeline in parallel (no breaking changes).**
Add the new Convex functions alongside existing ones. Update `ingestMaterial` to route scanned PDFs to `processOcr` instead of the OpenRouter path. Keep the OpenRouter code path active but behind a feature flag so you can compare results.

**Phase 2 — backfill existing `ocr_needed` records.**
Write a one-time Convex action `backfillOcrNeeded` that queries all materials with `status === "ocr_needed"`, verifies the `storageId` is still valid (Convex storage does not expire), and re-schedules `processOcr` for each. Run this in batches of 50 with `ctx.scheduler.runAfter` staggering to avoid hitting Mistral rate limits simultaneously. Log results to `ocrAuditLog`.

**Phase 3 — remove dead code.**
Once backfill is complete and the new pipeline has run cleanly for 2+ weeks, remove the OpenRouter PDF parsing path, the browser canvas rendering code, and any intermediate patch code from `lessonKnowledgePdfExtraction.ts`. Clean up any `ocr_needed` status records that could not be recovered (no valid storageId) by marking them `failed` with a descriptive audit log entry so teachers know to re-upload.

**Phase 4 — document the architecture.**
Update `docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md` and `docs/issues/FR-016.md` to reflect the final data flow and close the issue.

---

## 9. MVP vs Long-Term Path

**MVP (2–3 sprints):**
Mistral OCR action as described above. Single provider. Manual retry button. Audit log. Backfill script for existing files. No queue abstraction needed — Convex's scheduler handles concurrency naturally.

**Long-term (if volume grows significantly):**
Add a provider abstraction layer (interface with `MistralOcrProvider`, `GoogleDocAiProvider`) so you can route by document type or fall back if one provider is degraded. Add a dedicated OCR queue table with priority, attempt count, and backoff state for finer-grained control. Consider a Tesseract/Poppler worker on Cloud Run for very high-volume schools who want on-premise data handling. Add per-school OCR usage metering tied to your billing tier.

---

## 10. Acceptance Criteria

- A scanned PDF uploaded by a teacher transitions from `processing` to `ready` with all pages chunked within 30 seconds for documents under 20 pages.
- An existing `ocr_needed` material can be retried without re-uploading, and produces the same chunk output as a fresh upload.
- A failed OCR attempt writes an `ocrAuditLog` record and displays a user-facing "OCR Failed — Retry" state.
- No OCR action reads or stores the Mistral API key anywhere except the Convex environment variable store.
- All DB writes include a `schoolId` that matches the authenticated user's school — verified by a test that attempts cross-school chunk injection.
- Page-range selection (e.g. pages 3–7) produces chunks only for the selected pages.
- After 5 failed attempts, the material status is permanently set to `failed` with a descriptive audit log entry, and no further retries are scheduled automatically.

---

## 11. Test Plan

**Unit tests:** `buildOcrPayload` correctly slices page ranges; `parseOcrResponse` maps Mistral page JSON to chunk schema; `setMaterialStatus` correctly transitions valid states and rejects invalid ones.

**Integration tests (Convex test environment):** Full happy path — upload → ingest → processOcr mock → saveChunks → status `ready`. Retry path — set status to `failed`, call `triggerOcrRetry`, verify re-schedule. Tenant boundary — verify cross-school mutation is rejected with auth error.

**End-to-end tests:** Upload a known scanned PDF, verify chunk count and page indices match expected values. Upload a native digital PDF, verify OCR path is not triggered.

**Regression test:** Existing native PDF extraction continues to work unchanged after migration.

---

## 12. Rollback Plan

Because the new pipeline is additive (new Convex functions deployed alongside old ones, with a feature flag routing to the new path), rollback is a single flag flip. Disable the Mistral OCR route in `ingestMaterial`, re-enable the OpenRouter path. No data migration is needed on rollback since chunk records written by the new pipeline are compatible with the existing schema. Revert the frontend retry button via the same feature flag or a separate one. The `ocrAuditLog` table retains all attempts for post-mortem analysis.