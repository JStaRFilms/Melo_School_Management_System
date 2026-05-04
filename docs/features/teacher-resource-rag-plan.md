# Teacher Resource Library RAG Plan

## Objective
Build a multi-format Teacher Resource Library that lets staff upload instructional materials, extract usable text from each file type, enrich it with OCR where needed, and retrieve the right passages with RAG.

## Scope
This plan covers:
- supported file formats
- upload limits and validation
- extraction adapters and OCR fallback
- chunking and embeddings
- vector retrieval strategy
- data model direction
- security and access control
- UI states and admin controls
- error handling
- FR-016 acceptance criteria
- build order

## Supported Formats
Primary support should include:
- PDF (`.pdf`)
- Word documents (`.docx`)
- PowerPoint decks (`.pptx`)
- plain text (`.txt`)
- Markdown (`.md`)
- images (`.png`, `.jpg`, `.jpeg`, `.webp`) for OCR-only ingestion

Optional later support:
- `.rtf`
- `.odt`
- `.csv` for simple resource tables

## Upload Limits
MUS implementation limits:
- Max file size: 12 MB per file across PDF, DOCX, PPTX, TXT, MD, PNG, JPG/JPEG, and WEBP
- Max selected PDF pages: 30 pages per selected-page ingestion
- Max native PDF parse scope: 80 pages when no selected-page range is provided
- Max extracted chunks: 24 chunks per resource in the current teacher planning library flow

Later configurable limits can expand by school plan:
- PDF: 25 MB
- DOCX: 15 MB
- PPTX: 30 MB
- Images: 10 MB each
- Max files per upload batch: 10
- Max resources per teacher: configurable by school/admin quota

Validation rules:
- Reject unsupported extensions early
- Reject encrypted/password-protected files unless a decryption flow exists
- Reject files over limit with a clear retry path
- Normalize filenames and preserve original name separately

## Extraction Adapters
Use one adapter per format so ingestion stays modular.

### PDF Adapter
- Prefer native text extraction first
- Fall back to OCR when text is absent, low quality, or image-heavy
- Preserve page numbers and page ranges

### DOCX Adapter
- Extract paragraphs, headings, tables, and notes
- Preserve document structure where possible
- Detect embedded images that may require OCR as supplemental text

### PPTX Adapter
- Extract slide text, speaker notes, and visible labels
- Keep slide numbers as metadata
- Treat each slide as a chunk source before sub-chunking

### TXT / MD Adapter
- Direct text ingestion
- Preserve headings and list structure

### Image OCR Adapter
- OCR-only path for standalone images
- Return confidence metadata where available

## OCR Strategy
Use OCR as a fallback, not the default.

Recommended behavior:
1. Run native extraction first.
2. If output is empty or below a quality threshold, queue OCR.
3. OCR should support page-level or image-level output.
4. Normalize OCR output into the same internal text shape as native extraction.
5. Keep OCR jobs resumable and idempotent.

OCR outputs should include:
- extracted text
- page or region reference
- confidence when available
- source adapter metadata

## Chunking Strategy
Chunk after extraction normalization.

Recommended chunk rules:
- Chunk by semantic boundaries first, not fixed token cuts only
- Respect headings, slide titles, paragraph breaks, and page boundaries
- Target chunk size: ~400–800 tokens
- Overlap: ~10–15% or one short supporting paragraph
- Keep chunks small enough for retrieval but large enough for context
- Store parent-source metadata for traceability

Required chunk metadata:
- resourceId
- schoolId
- sourceType
- pageStart/pageEnd or slideStart/slideEnd
- chunkIndex
- title or heading path
- extractionMethod (`native`, `ocr`, `hybrid`)
- checksum/version

## Embeddings and Vector Retrieval
### Embeddings
- Generate embeddings per chunk
- Embed the normalized chunk text, not raw file blobs
- Re-embed when the resource changes or extraction version changes
- Keep embedding model choice configurable

### Retrieval
- Use vector similarity as the primary retrieval signal
- Add metadata filters for school, class, subject, resource type, and visibility
- Use hybrid ranking when available: vector similarity + keyword match + recency/frequency boost
- Return top-k chunks with source citations
- Support reranking if retrieval quality needs improvement later

Recommended retrieval flow:
1. User asks a question.
2. Build query embedding.
3. Filter to allowed school-scoped resources.
4. Retrieve top candidates.
5. Rerank if needed.
6. Return cited chunks and source file references.

## Data Model Direction
Suggested entities:
- `resources`
- `resourceFiles`
- `resourceExtractions`
- `resourceChunks`
- `resourceEmbeddings`
- `resourceSearchJobs` or `resourceIngestionJobs`
- `resourceAccessLogs`

Key fields to capture:
- `schoolId`
- `ownerUserId`
- `createdByUserId`
- `title`
- `description`
- `subjectIds`
- `classIds`
- `fileName`
- `mimeType`
- `storageId`
- `extractionStatus`
- `ocrStatus`
- `chunkCount`
- `embeddingModel`
- `visibility`
- `version`
- `errorCode`
- `errorMessage`
- `createdAt` / `updatedAt`

## Security Model
- All access must be school-scoped server-side
- Never trust client-provided ownership or school IDs
- Teachers can only access resources they created or that are shared to their school/role
- Admins can manage school-wide resources and retry failed ingestions
- Storage URLs must be generated server-side only
- Do not persist signed URLs
- Redact provider errors before showing them to users
- Add rate limits for uploads, OCR, and search requests

## UI States
### Upload / Ingest States
- idle
- validating
- uploading
- queued
- extracting
- OCR needed
- indexing
- ready
- failed

### Resource Library States
- empty state
- list/grid browsing
- filtering and search
- per-resource status badge
- ingestion progress indicator
- retry action for failed jobs

### Retrieval States
- searching
- no results
- partial results
- cited answer ready
- source preview available
- retrieval error

## Admin Controls
Admins should be able to:
- view all school resources
- retry failed extractions and OCR jobs
- delete resources and derived vectors
- change visibility or ownership rules
- set upload quotas and file-type policy
- view ingestion health and job logs
- reprocess a resource with a new extractor/embedding version

## Error Handling
Handle errors with stable codes and user-safe messaging.

Common cases:
- unsupported file type
- file too large
- extraction failed
- OCR failed
- embedding failed
- vector index unavailable
- permission denied
- resource deleted during processing
- stale job / duplicate retry

Error behavior:
- keep original file record even when processing fails
- preserve debug details in backend logs only
- allow retry when the failure is transient
- mark permanent failures clearly

## FR-016 Acceptance Criteria
FR-016 should be considered done only when:
- teachers can upload at least PDF, DOCX, PPTX, TXT, MD, and image files
- files are validated against size/type limits before ingestion starts
- native extraction works for text-based files
- OCR fallback works for scanned or image-only content
- chunking preserves source traceability and page/slide references
- embeddings are generated for searchable chunks
- retrieval returns school-scoped results with citations
- the UI shows all major ingestion states
- admins can retry or reprocess failed resources
- cross-school access is blocked at every layer
- failed jobs remain recoverable without reuploading the original file

## Build Order
Recommended implementation sequence:
1. Define resource and ingestion data model
2. Add upload validation and storage plumbing
3. Implement native extractors for text-first formats
4. Add OCR fallback for scanned/image-only inputs
5. Normalize extraction output into chunkable text
6. Implement chunking with source metadata
7. Generate embeddings and persist vectors
8. Build school-scoped vector retrieval
9. Add UI states for upload, progress, failure, and search
10. Add admin retry and reprocess controls
11. Add logs, rate limits, and recovery paths
12. Tune retrieval quality and ranking

## Notes
- Prefer one ingestion pipeline with pluggable adapters over format-specific one-off flows.
- Keep retrieval and ingestion decoupled so reindexing can happen without re-upload.
- Preserve source provenance end-to-end so answers can cite exactly where the text came from.
