## Recommended architecture

**Primary recommendation: Convex-managed OCR job orchestration + dedicated OCR API, with optional external worker later.**

Keep **Convex as the source of truth**, but stop trying to make Convex do PDF rendering. Convex should decide *what* needs OCR, authorize the request, track status, store metadata/chunks, and audit the pipeline. The actual OCR should happen outside Convex’s native runtime constraints.

My strong opinion: **use Mistral OCR as the MVP provider**, with the architecture designed so you can swap to **Google Document AI / Azure Document Intelligence** later if accuracy, compliance, or enterprise requirements demand it.

Mistral OCR is attractive for this exact use case because it accepts PDFs/images and returns structured OCR output suitable for RAG-style document ingestion. Mistral describes its OCR processor as returning extracted text, image bounding boxes, and document-structure metadata, and its docs support OCR for PDFs and images. ([Mistral AI Documentation][1])

The long-term architecture should support multiple providers behind one internal interface:

```ts
OcrProvider = "mistral" | "google_document_ai" | "azure_document_intelligence" | "aws_textract" | "external_worker"
```

Convex should never care deeply about provider-specific shapes. It should store normalized OCR pages.

---

## Architecture options review

### 1. Dedicated OCR API

This is the best MVP path.

**Pros**

* No PDF rendering inside Convex.
* Works for existing stored PDFs.
* Handles scanned/image-heavy PDFs better than native text extraction.
* Easier retry model.
* Faster to ship.
* Provider handles PDF rasterization, OCR, layout, tables, handwriting, and page structure.

**Cons**

* External provider cost.
* Data leaves your infra, so you need school/tenant privacy controls.
* Provider-specific limits and outages.
* You need signed URL/file handoff carefully.

**Best fit:** production MVP.

Recommended providers:

* **Mistral OCR** for fast MVP and cost-effective document-to-markdown/text.
* **Google Document AI** or **Azure Document Intelligence** for enterprise-grade OCR/compliance fallback.
* **AWS Textract** only if your stack is already AWS-heavy.

Google Document AI’s Enterprise Document OCR pricing is listed at **$1.50 per 1,000 pages** for the first 5M pages/month, with lower pricing beyond that. ([Google Cloud][2]) Azure Document Intelligence Read pricing is also listed around **$1.50 per 1,000 pages** for 0–1M pages, with a free tier of 500 pages/month. ([Microsoft Azure][3]) Mistral’s OCR announcement described pricing around **1,000 pages per dollar**, with batch inference improving throughput/cost, though current pricing should be checked at integration time. ([Mistral AI][4])

---

### 2. External worker/service

This is the best long-term architecture if you need control.

Example:

```txt
Convex
  ↓ creates OCR job
External OCR Worker on Render/Fly/Railway/AWS/GCP
  ↓ downloads file from Convex signed URL
  ↓ uses provider API or Poppler/Tesseract
  ↓ posts normalized pages back to Convex
Convex
  ↓ chunks/indexes/audits
Frontend
  ↓ shows status
```

**Pros**

* Can use native tools like Poppler, Tesseract, pdfium, sharp, imagemagick, etc.
* Can do page splitting, compression, preprocessing, deskewing, rotation detection.
* Can implement queue/concurrency/rate limiting cleanly.
* Can fallback between providers.
* Keeps Convex clean.

**Cons**

* More infra.
* More deployment/monitoring.
* Must secure worker-to-Convex calls.
* Overkill for first version unless OCR is already a core paid feature.

**Best fit:** long-term, or MVP if dedicated OCR APIs require file hosting format you cannot satisfy directly from Convex.

---

### 3. Browser-side rendering

This sounds tempting but is a trap for production.

**Pros**

* Avoids backend native modules.
* Can use browser PDF rendering.
* Teacher’s device does some work.
* Might help for new uploads.

**Cons**

* Bad for existing stored PDFs unless you ask users to reopen/reprocess them.
* Slow on weak phones/laptops.
* Browser memory problems on large PDFs.
* Hard to make retryable.
* Upload can fail halfway.
* Security model gets messier.
* Inconsistent rendering across devices.
* Page-aware OCR becomes frontend-dependent.

**Best fit:** maybe a fallback/manual “extract this page from my browser” tool, not the main pipeline.

I would not make this the production pipeline.

---

### 4. OpenRouter / multimodal LLM-only OCR

Not recommended as the primary OCR layer.

**Pros**

* Easy API abstraction.
* Can interpret complex visual pages.
* Useful for post-OCR cleanup, summarization, or semantic extraction.

**Cons**

* Vision LLMs are not deterministic OCR engines.
* Page ordering can be unreliable.
* Large PDFs need splitting anyway.
* Token/image limits become painful.
* Cost can be unpredictable.
* Output may be paraphrased instead of exact.
* Tables, page headers, page numbers, and mathematical content can drift.
* Not ideal for auditability.

**Best fit:** secondary enrichment after OCR, not raw extraction.

Use LLMs to clean, classify, summarize, or convert OCR text into lesson-planning structure. Do not use them as your only OCR engine.

---

## Why the previous approaches failed or are risky

### Convex + native canvas/PDF rendering

Convex is not the place to run native rendering stacks. Packages like `@napi-rs/canvas`, native `.node` modules, Poppler bindings, or heavyweight rasterizers are likely to fail bundling or runtime constraints. Even when they work locally, serverless/edge-ish environments punish this kind of workload.

### Browser PDF rendering

It can work for demos, but it creates a pipeline where extraction quality depends on the teacher’s browser, device, memory, network, and whether they keep the tab open. That’s not a reliable school-management-system backend.

### OpenRouter/Gemma PDF parsing

This is the classic “LLM is almost OCR” problem. It may parse some documents impressively, then randomly fail on page order, small text, tables, handwriting, scans, rotated pages, or large PDFs. It’s okay as an assistant, not as infrastructure.

---

## Exact data flow

### New upload flow

```txt
1. Teacher uploads PDF/text file from /planning/library.
2. Convex stores original file in Convex storage.
3. Convex creates material row:
   status = "uploaded"
   extractionStatus = "pending"
   schoolId, teacherId, storageId, mimeType, pageSelection, createdAt
4. Convex action runs native text extraction for digital PDFs.
5. If enough text is extracted:
   status = "ready"
   extractionMethod = "native_pdf_text"
   create page-aware chunks
6. If native extraction fails or text density is too low:
   status = "ocr_needed"
   create OCR job row
7. OCR action starts provider job.
8. Provider returns OCR text per page.
9. Convex stores normalized OCR pages.
10. Convex chunks page-aware text.
11. Material becomes:
   status = "ready"
   extractionMethod = "ocr:mistral"
```

### Existing failed / ocr_needed flow

```txt
1. Teacher sees existing material marked "OCR needed".
2. Teacher clicks "Run OCR" or admin runs bulk retry.
3. Convex validates teacher belongs to same school.
4. Convex creates retryable OCR job from existing storageId.
5. OCR provider processes original stored PDF.
6. Convex replaces/augments failed extraction result.
7. Material becomes "ready" or "ocr_failed".
```

No re-upload required because the original `storageId` already exists.

---

## Page-aware behavior

This is important.

The system should store OCR output like this:

```ts
ocrPages: {
  materialId: Id<"lessonMaterials">;
  schoolId: Id<"schools">;
  pageNumber: number;
  text: string;
  markdown?: string;
  provider: string;
  confidence?: number;
  width?: number;
  height?: number;
  blocks?: Array<{
    type: "paragraph" | "table" | "heading" | "image" | "unknown";
    text: string;
    bbox?: number[];
  }>;
  createdAt: number;
}
```

Then chunks should preserve page metadata:

```ts
lessonKnowledgeChunks: {
  materialId;
  schoolId;
  text;
  pageStart;
  pageEnd;
  chunkIndex;
  extractionMethod;
  source: "native_pdf_text" | "ocr";
  provider?: "mistral" | "google" | "azure" | "aws";
}
```

If teachers selected page ranges, OCR should only ingest those pages *where possible*. If the chosen provider only accepts whole PDFs, you still store all OCR pages internally but only chunk/index the selected range. The user-facing library should respect selected pages, not accidentally expose unselected content in search.

---

## Convex tables to add or adjust

### `lessonMaterials`

Add or confirm fields:

```ts
extractionStatus:
  | "pending"
  | "extracting"
  | "ready"
  | "ocr_needed"
  | "ocr_queued"
  | "ocr_processing"
  | "ocr_failed"
  | "failed";

extractionMethod?: 
  | "text_file"
  | "native_pdf_text"
  | "ocr";

ocrProvider?: string;
ocrAttemptCount?: number;
ocrLastError?: string;
ocrLastAttemptAt?: number;
ocrCompletedAt?: number;
pageCount?: number;
selectedPageRanges?: Array<{ start: number; end: number }>;
```

### `lessonOcrJobs`

```ts
{
  schoolId;
  materialId;
  storageId;
  requestedByUserId;
  status: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  provider: "mistral" | "google_document_ai" | "azure_document_intelligence" | "aws_textract" | "external_worker";
  attempt: number;
  maxAttempts: number;
  pageRanges?: Array<{ start: number; end: number }>;
  providerJobId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt;
  startedAt?: number;
  completedAt?: number;
}
```

### `lessonOcrPages`

```ts
{
  schoolId;
  materialId;
  jobId;
  pageNumber;
  text;
  markdown?: string;
  blocksJson?: unknown;
  confidence?: number;
  provider;
  createdAt;
}
```

### `lessonIngestionAuditLogs`

```ts
{
  schoolId;
  materialId;
  actorUserId?: string;
  action:
    | "upload_created"
    | "native_extraction_started"
    | "native_extraction_succeeded"
    | "native_extraction_failed"
    | "ocr_queued"
    | "ocr_started"
    | "ocr_succeeded"
    | "ocr_failed"
    | "chunks_created"
    | "retry_requested";
  metadata?: unknown;
  createdAt;
}
```

---

## Convex functions/mutations/actions needed

### Mutations

#### `requestOcrForMaterial`

Validates:

* user is authenticated
* user belongs to material’s school
* material belongs to same school
* material has file in Convex storage
* material status is `ocr_needed`, `ocr_failed`, or manually retryable

Does:

* creates `lessonOcrJobs`
* updates material to `ocr_queued`
* writes audit log

---

#### `markOcrJobProcessing`

Used by Convex action or external worker.

Validates:

* job exists
* job is queued/retryable
* tenant boundary preserved

---

#### `saveOcrResult`

Accepts normalized OCR pages.

Does:

* deletes/replaces previous failed OCR pages for same material/job strategy
* inserts `lessonOcrPages`
* updates material fields
* writes audit log
* schedules chunking

---

#### `markOcrJobFailed`

Stores:

* safe error message
* provider error code
* attempt count
* retryable boolean
* next retry time if automatic retry is enabled

---

#### `retryOcrJob`

Creates a new job or increments attempt.

---

#### `bulkQueueOcrForSchool`

Admin-only or internal migration mutation.

Finds materials with:

* `ocr_needed`
* `failed` with reason `NO_TEXT_EXTRACTED`
* `ocr_failed` and attempts below limit

---

### Actions

#### `extractLessonMaterialText`

Current native extraction action should remain, but become conservative.

Flow:

```txt
try native text extraction
if usable text density:
  save native result
else:
  mark ocr_needed
```

Do not keep trying five hacky PDF-rendering paths.

---

#### `runOcrJob`

Convex action version for MVP.

Flow:

```txt
1. Load job and material.
2. Validate school boundary.
3. Get Convex storage URL for file.
4. Call OCR provider.
5. Normalize provider result into pages.
6. Call saveOcrResult.
7. Trigger chunking.
```

This is okay if the provider accepts URL/file input and the files are not too huge. If the action timeout or file transfer becomes a problem, move this to an external worker.

---

#### `chunkOcrMaterial`

Uses page-aware pages.

Flow:

```txt
1. Load OCR pages for material.
2. Filter by selected page ranges.
3. Chunk with pageStart/pageEnd.
4. Store chunks.
5. Mark material ready.
```

---

## Frontend UX changes at `/planning/library`

### Material status labels

Show clear states:

```txt
Extracting text...
OCR needed
OCR queued
OCR processing
Ready
OCR failed
```

### For `ocr_needed`

Show:

```txt
This PDF looks scanned or image-heavy. We can run OCR on the stored file, so you do not need to upload it again.
[Run OCR]
```

### For `ocr_failed`

Show:

```txt
OCR failed on the last attempt.
Reason: Provider timeout / unsupported file / page limit / rate limit
[Retry OCR]
[Upload a clearer copy]
```

Only suggest re-upload if:

* original file is missing
* provider says corrupted/unsupported
* file is password-protected
* file exceeds size/page limits

### For page ranges

When teacher selects pages:

* Show selected page range before OCR.
* Store selected ranges with material.
* After OCR, say: “Indexed pages 3–8 from this document.”
* Do not imply the whole PDF was added if only selected pages were indexed.

### Admin / school owner UX

Add:

* “Retry all OCR-needed files”
* “OCR usage this month”
* “Failed OCR jobs”
* “Provider errors”
* “Estimated pages processed”

---

## Provider recommendation

### MVP provider: Mistral OCR

Use **Mistral OCR first**.

Why:

* Simple document-OCR API.
* Designed for PDFs/images.
* Returns structured text/markdown-like output.
* Good fit for RAG ingestion.
* Likely faster to integrate than Google/Azure/AWS document ecosystems.
* Cost profile looks friendly for school documents. Mistral’s OCR documentation supports PDFs/images and its launch materials position it specifically for RAG-style multimodal document ingestion. ([Mistral AI Documentation][1])

### Production fallback provider: Azure Document Intelligence or Google Document AI

Pick one fallback based on your infra preference.

I would choose:

```txt
Primary: Mistral OCR
Fallback: Azure Document Intelligence Read/Layout
Enterprise fallback: Google Document AI
```

Azure Document Intelligence Read extracts printed and handwritten text from scanned and digital PDFs, and detects paragraphs, lines, words, locations, and languages. ([Microsoft Learn][5]) Azure’s layout model also extracts document structure such as tables and selection marks. ([Azure Documentation][6])

Google Document AI is excellent, but setup and processor management can feel heavier. It is strong if you later want custom processors or more enterprise workflows. Google lists multiple Document AI processors, including OCR and custom extraction processors. ([Google Cloud Documentation][7])

### AWS Textract

Good, but not my first choice unless your files already live in S3. Textract’s async PDF OCR flow expects documents in S3 for `StartDocumentTextDetection`, which adds staging complexity if Convex storage is your source of truth. ([AWS Documentation][8])

### External Tesseract/Poppler worker

Good long-term fallback, especially if:

* costs become too high
* data residency becomes important
* providers fail on local curriculum scans
* you need preprocessing

But don’t start here unless you already want to run a worker.

### OpenRouter vision model

Use only as:

* fallback for small images
* semantic cleanup
* extracting lesson metadata from already-OCRed text
* interpreting diagrams after OCR

Not as primary OCR.

---

## Security considerations

### Auth

Every mutation/action must verify:

* authenticated user
* user belongs to school
* user has teacher/admin role for that school
* material belongs to same `schoolId`

Never accept `schoolId` from frontend as trusted. Derive it from the authenticated user/session and material row.

### Signed URLs

Use short-lived signed URLs for OCR provider/worker access.

Rules:

* generate URL only server-side
* short expiry
* one material/job at a time
* do not expose provider upload URLs to the browser unless necessary
* never store signed URLs permanently in Convex tables

### Storage access

Convex storage remains canonical.

External worker/provider gets temporary access only.

For providers requiring file upload:

* Convex action fetches file from storage
* uploads to provider
* provider file ID is stored only in OCR job metadata if needed
* delete provider-side file after OCR if API supports it

### Tenant boundaries

Every OCR row must include `schoolId`.

Queries should always filter by:

```ts
schoolId + materialId
```

Never query OCR pages or chunks by `materialId` alone unless material ownership was already verified.

### Rate limits

Add:

* per-school OCR page quota
* per-user retry cooldown
* max attempts per material
* max file size
* max page count
* provider concurrency limit

Example MVP limits:

```txt
Max file size: 25–50 MB
Max OCR pages per material: 100–300
Max retries: 3
Max concurrent OCR jobs per school: 2
Daily OCR page quota per school plan
```

### Audit logs

Log:

* who requested OCR
* provider used
* page count
* selected page ranges
* success/failure
* retry attempts
* provider error category
* chunk count created

Do not log raw document text into audit logs.

---

## Cost/performance considerations

The biggest cost driver is **pages**, not files.

Add `estimatedPageCount` as early as possible.

For MVP:

* Native extract first.
* OCR only when text density is poor.
* OCR selected page ranges only when possible.
* Use batch mode for bulk reprocessing existing files.
* Cache OCR results permanently.
* Never OCR the same material twice unless explicitly retrying after failure or changing selected pages.

Cost guardrail example:

```txt
Native PDF text extraction: free/cheap
Mistral OCR: use for scanned/image-heavy PDFs
Azure/Google: fallback for failed or high-value documents
LLM cleanup: only after OCR, only on selected chunks
```

Performance:

* Process OCR asynchronously.
* UI should not block upload completion.
* Chunk after OCR pages are saved.
* Search/index availability should be eventual, not synchronous.
* Show progress states.

---

## Migration / cleanup plan

### Keep

Keep:

* existing native text extraction for digital PDFs
* existing chunking and metadata model
* existing `ocr_needed` state
* existing page-aware indexing concepts from `SmartPdfPageSelectionAndPageAwareIndexing.md`

### Remove or isolate

Remove from Convex runtime:

* browser PDF rendering hacks
* native canvas/rendering packages
* OpenRouter/Gemma as primary PDF parser
* any code path that tries to rasterize PDFs inside Convex

Move experimental logic behind feature flags:

```ts
OCR_PROVIDER=mistral
ENABLE_OPENROUTER_OCR_FALLBACK=false
ENABLE_BROWSER_OCR=false
```

### Patch current files conceptually

#### `lessonKnowledgePdfExtraction.ts`

Should only do:

* digital PDF text extraction
* text density checks
* page count detection if available
* return `ocr_needed` when extraction is insufficient

#### `lessonKnowledgeIngestionActions.ts`

Add:

* `runOcrJob`
* provider dispatch
* OCR normalization

#### `lessonKnowledgeIngestion.ts`

Add:

* mutations for queueing, status updates, saving OCR pages, retries

#### `lessonKnowledgeIngestionHelpers.ts`

Add:

* text-density scoring
* page-range filtering
* OCR result normalization
* chunk generation from OCR pages

#### `/planning/library/page.tsx`

Add:

* OCR-needed cards
* retry buttons
* status chips
* failure reason
* no-reupload messaging

#### `FR-016.md`

Update with the accepted architecture and MVP scope.

---

## MVP implementation plan

### Phase 1: Stabilize current extraction

1. Keep native extraction for digital PDFs.
2. Add a clear text-density threshold.
3. Mark poor extraction as `ocr_needed`.
4. Stop trying unreliable PDF rendering in Convex.

Acceptance for this phase:

```txt
Digital PDF → ready
Scanned PDF → ocr_needed
Text file → ready
Corrupt PDF → failed with safe error
```

---

### Phase 2: Add OCR job model

1. Add `lessonOcrJobs`.
2. Add `lessonOcrPages`.
3. Add audit logs.
4. Add `requestOcrForMaterial`.
5. Add status transitions.

Acceptance:

```txt
Teacher can queue OCR for existing ocr_needed material.
Material changes from ocr_needed → ocr_queued.
Audit log records request.
No re-upload required.
```

---

### Phase 3: Integrate Mistral OCR

1. Create provider adapter:

   ```ts
   runMistralOcr({ fileUrl, pageRanges, mimeType })
   ```
2. Normalize response into pages.
3. Save pages.
4. Chunk selected pages.
5. Mark material ready.

Acceptance:

```txt
Scanned PDF in Convex storage becomes searchable/indexed.
Chunks include pageStart/pageEnd.
Teacher sees ready state.
```

---

### Phase 4: Retry and failure handling

1. Add max attempts.
2. Store provider-safe error.
3. Add retry button.
4. Add admin bulk retry.

Acceptance:

```txt
Provider failure does not corrupt material.
Retry creates a new attempt.
Old failed state is visible but recoverable.
```

---

### Phase 5: Optional external worker

Only do this if Convex action timeouts/file handling become painful.

Worker responsibilities:

* pull queued jobs
* download Convex signed file URL
* call OCR provider
* optionally preprocess/split PDFs
* call Convex mutation to save result

---

## Long-term path

Long-term, the best system is:

```txt
Convex = source of truth + auth + metadata + audit + chunks
Worker = PDF preprocessing + provider orchestration + retries
Mistral = default OCR
Azure/Google = fallback/enterprise OCR
LLM = post-OCR cleanup/extraction only
```

Add:

* provider fallback chain
* school-level OCR quotas
* OCR usage dashboard
* batch reprocessing
* confidence scoring
* human review for low-confidence pages
* table-aware chunking
* duplicate detection by file hash
* provider-level deletion/privacy controls

---

## Risks

### Provider lock-in

Mitigation:

* normalize OCR output immediately
* keep provider adapter interface
* never store only provider-specific response

### Cost spikes

Mitigation:

* page quotas
* selected page ranges
* native extraction first
* admin approval for large files
* monthly usage dashboard

### Tenant leakage

Mitigation:

* schoolId on every row
* strict authorization in every mutation/action
* short-lived signed URLs
* no global material queries

### Provider outage

Mitigation:

* retryable job queue
* fallback provider
* clear frontend state
* no destructive updates until OCR succeeds

### Bad OCR quality

Mitigation:

* store per-page text
* allow reprocess with another provider
* add manual text upload/paste as last resort
* preserve original file forever unless deleted by authorized user

---

## Acceptance criteria

### Functional

* Digital PDFs still extract without OCR.
* Scanned PDFs become `ocr_needed`.
* Existing `ocr_needed` files can be processed without re-upload.
* OCR results are stored page-by-page.
* Chunks preserve page metadata.
* Selected page ranges are respected.
* Failed OCR jobs are retryable.
* Teachers see useful status and error messages.
* Admin can bulk retry OCR-needed materials.

### Security

* Teacher cannot OCR another school’s material.
* Signed file URLs are short-lived.
* OCR jobs are tied to `schoolId`.
* Audit logs capture OCR lifecycle.
* Provider errors do not expose secrets.

### Reliability

* Provider timeout marks job failed, not material destroyed.
* Re-running OCR does not duplicate chunks incorrectly.
* Partial failures are recoverable.
* Large files are rejected or queued safely.

### Performance

* Upload does not wait for OCR.
* OCR runs asynchronously.
* Search becomes available after chunking.
* Reprocessing existing files is batchable.

---

## Test plan

### Unit tests

Test:

* text-density detection
* page-range filtering
* OCR result normalization
* chunk page metadata
* status transitions
* retry attempt limits
* authorization helpers

### Integration tests

Cases:

```txt
1. Digital PDF with selectable text
2. Scanned PDF
3. Mixed PDF: first pages digital, later scanned
4. Image-heavy PDF with little text
5. Password-protected PDF
6. Corrupt PDF
7. Large PDF above limit
8. Selected pages 3–5 only
9. Provider timeout
10. Provider malformed response
11. Retry after failure
12. Cross-school access attempt
```

### E2E tests

Teacher journey:

```txt
Upload scanned PDF
See OCR needed
Click Run OCR
See OCR processing
Return later
See Ready
Use planning library search
Open result and see page reference
```

Admin journey:

```txt
Open failed OCR list
Bulk retry
View success/failure counts
Check audit log
```

---

## Rollback plan

Keep OCR isolated behind a feature flag:

```txt
ENABLE_DEDICATED_OCR=false
```

Rollback steps:

1. Disable OCR queue button in frontend.
2. Stop scheduling new OCR jobs.
3. Leave existing materials and native extraction untouched.
4. Existing OCR pages/chunks can remain; they are just indexed content.
5. Failed/in-progress OCR jobs are marked `cancelled` or left retryable.
6. Revert to current behavior:

   ```txt
   digital PDFs work
   scanned PDFs remain ocr_needed
   ```
7. No stored original PDFs are deleted.

The key design choice: **OCR should be additive, not destructive**. The original file stays in Convex storage, native extraction stays working, and OCR simply adds better page-aware text when needed.

[1]: https://docs.mistral.ai/studio-api/document-processing/basic_ocr?utm_source=chatgpt.com "OCR Processor | Mistral Docs"
[2]: https://cloud.google.com/document-ai/pricing?utm_source=chatgpt.com "Document AI pricing"
[3]: https://azure.microsoft.com/en-us/pricing/details/document-intelligence/?utm_source=chatgpt.com "Azure Document Intelligence in Foundry Tools pricing"
[4]: https://mistral.ai/news/mistral-ocr?utm_source=chatgpt.com "Mistral OCR"
[5]: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0&utm_source=chatgpt.com "Read model OCR data extraction - Document Intelligence"
[6]: https://docs.azure.cn/en-us/ai-services/document-intelligence/prebuilt/layout?view=doc-intel-4.0.0&utm_source=chatgpt.com "What is the Document Intelligence layout model?"
[7]: https://docs.cloud.google.com/document-ai/docs/processors-list?utm_source=chatgpt.com "Processor list | Document AI"
[8]: https://docs.aws.amazon.com/textract/latest/dg/API_StartDocumentTextDetection.html?utm_source=chatgpt.com "StartDocumentTextDetection - Amazon Textract"
