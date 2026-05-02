# Mistral OCR Provider Action

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-build` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before implementation.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Build handoff conventions |
| convex-functions | Node action and internal mutation boundaries |
| convex-security-check | Secret and signed URL handling |

## Role

Backend Integration Engineer.

## Recommended Model

GPT-5.5.

## Objective

Implement Mistral OCR fallback as a Convex Node action behind a provider adapter.

## Files Likely Touched

- `packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts`
- `packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts`
- New provider/helper file under `packages/convex/functions/academic/` if needed
- `docs/features/ReliableScannedPdfOcrFallback.md`

## Dependencies

- Task 03 complete.
- Task 05 complete.

## Acceptance Criteria

- Native extraction remains first pass.
- Scanned/image-heavy PDFs can queue and run provider OCR from existing Convex storage.
- Mistral API key is read only from Convex environment variables.
- Signed storage URLs are generated only server-side and never persisted.
- Provider output is normalized into page-level results.
- Provider errors are mapped to safe categories and do not crash the app.
- OpenRouter/Gemma is not the primary OCR fallback.
- Browser rendering is not required for stored-PDF retry.

## Verification Commands

- `pnpm typecheck`
- Mocked provider integration test if available
