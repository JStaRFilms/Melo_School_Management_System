# Task 09: PDF Parser Upgrade

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/features/LessonKnowledgeHub_v1.md`.
- Read `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`.
- Inspect PDF parsing and knowledge material ingestion code.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `pdf`
- `convex`
- `nextjs-standards`
- `webapp-testing`
- `sync-docs`

## Objective

Upgrade PDF extraction for curricula, lessons, and scanned school documents with OCR support, graceful fallbacks, and better performance handling.

## Scope

- Improve text extraction for normal PDFs.
- Add or improve OCR fallback for scanned/image-heavy PDFs.
- Add clear error and partial-success states.
- Improve chunking and processing behavior for larger PDFs.
- Preserve current knowledge ingestion contracts unless a documented migration is required.

## Acceptance Criteria

- Normal text PDFs extract cleanly.
- Scanned PDFs attempt OCR and return useful text or a clear failure state.
- Large PDFs avoid blocking or crashing the UI.
- Users see understandable fallback/error messages.
- Tests or fixtures cover text PDF, scanned PDF, weak extraction, and parser failure.
- Docs are updated with parser capabilities and limitations.
