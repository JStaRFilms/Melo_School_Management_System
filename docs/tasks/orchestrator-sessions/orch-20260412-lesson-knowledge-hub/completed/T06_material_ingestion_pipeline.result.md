# T06 Material Ingestion Pipeline Result

## Outcome

`T06` is complete. The Lesson Knowledge Hub backend now has a parser-first ingestion path for uploaded materials and registered YouTube links, including storage URL issuance, material creation, extraction orchestration, chunk/index updates, truthful status handling, audit logging, and a deployed Gemini fallback path for parser failures or scanned/problematic PDFs.

## What Changed

- added ingestion helpers in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
- added Convex mutations/internal mutations in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
- added Node-side ingestion action in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts`
- added real PDF parsing + Gemini fallback helper in:
  - `packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts`
- added PDF parsing dependency:
  - `pdfjs-dist`
- extended `knowledgeMaterials` with ingestion-tracking fields:
  - `processingStatus`
  - `ingestionErrorMessage`
  - `ingestionAttemptCount`
  - `labelSuggestions`
  - `chunkCount`
  - `indexedAt`
- extended audit event types for ingestion lifecycle tracking
- updated the knowledge-material search contract to include `searchStatus`
- added focused helper tests in:
  - `packages/convex/functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts`

## Ingestion Behavior

- staff can request upload URLs and create material shells
- teacher uploads default to `private_owner` + `draft`
- admin uploads default to `staff_shared` + `approved`
- file uploads finalize against a stored `storageId`, then queue processing
- YouTube links register directly and run through the same material-domain ingestion path
- PDF uploads are parsed with `pdfjs-dist` first
- Gemini fallback is attempted only when parser output is missing, unreadable, or scanned/problematic
- missing `GEMINI_API_KEY` fails honestly instead of pretending OCR/AI ran
- `GEMINI_API_KEY` has now been configured on both the active dev deployment and the prod deployment so the fallback can run in local verification and deployed mode
- inadequate extraction ends in recoverable `ocr_needed`
- failed extraction ends in recoverable `failed`
- successful extraction writes chunks to `knowledgeMaterialChunks` and marks the material indexed
- ingestion lifecycle writes `contentAuditEvents`
- the old manual PDF stream parser path was removed from the live action path

## Verification

- `pnpm install`
- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `cd packages/convex && pnpm exec vitest run functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts`
- `pnpm exec convex env set GEMINI_API_KEY ...`
- `CONVEX_DEPLOYMENT=prod:outgoing-warbler-782 pnpm exec convex env set GEMINI_API_KEY ...`
- `CONVEX_DEPLOYMENT=prod:outgoing-warbler-782 pnpm exec convex deploy`

## Notes

- OCR fallback is intentionally represented as a recoverable `ocr_needed` state; no OCR engine was added in this task.
- The ingestion path is backend-only and does not yet wire any admin/teacher UI flows.
- Deferred cleanup: there is no remaining live manual PDF parser path, but the Gemini request builder could be shared later if another AI-heavy ingestion route needs the same fallback.
- Production deploy succeeded against `outgoing-warbler-782` after explicitly targeting the prod deployment to avoid the dev-deployment confirmation prompt.
