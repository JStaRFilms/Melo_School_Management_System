# T06 Material Ingestion Pipeline Result

## Outcome

`T06` is complete. The Lesson Knowledge Hub backend now has a Convex ingestion path for uploaded materials and registered YouTube links, including storage URL issuance, material creation, extraction orchestration, chunk/index updates, and audit logging.

## What Changed

- added ingestion helpers in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
- added Convex mutations/internal mutations in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
- added Node-side ingestion action in:
  - `packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts`
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
- native PDF extraction is attempted first in the Node action
- inadequate extraction ends in recoverable `ocr_needed`
- failed extraction ends in recoverable `failed`
- successful extraction writes chunks to `knowledgeMaterialChunks` and marks the material indexed
- ingestion lifecycle writes `contentAuditEvents`

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `cd packages/convex && pnpm exec vitest run functions/academic/__tests__/lessonKnowledgeAccess.test.ts functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts`

## Notes

- OCR fallback is intentionally represented as a recoverable `ocr_needed` state; no OCR engine was added in this task.
- The ingestion path is backend-only and does not yet wire any admin/teacher UI flows.
