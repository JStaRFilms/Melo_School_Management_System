# OpenRouter mistral-ocr Provider Action

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

Implement OCR fallback as a Convex Node action that calls OpenRouter chat completions with the `file-parser` plugin pinned to `engine: "mistral-ocr"`.

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
- OpenRouter API key is read only from Convex environment variables.
- The OpenRouter PDF engine is explicitly set to `mistral-ocr`; do not rely on OpenRouter defaults.
- Signed storage URLs are generated only server-side and never persisted.
- Provider output is normalized into page-level results.
- Provider errors are mapped to safe categories and do not crash the app.
- Free OpenRouter/Gemma `cloudflare-ai` parsing is not the primary scanned-PDF OCR fallback.
- Browser rendering is not required for stored-PDF retry.

## Verification Commands

- `pnpm typecheck`
- Mocked provider integration test if available
