# Documentation Sync

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-syncDocs` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before documentation work.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow workflow handoff conventions |
| sync-docs | Keep docs aligned with implementation |

## Role

Documentation Engineer.

## Recommended Model

GPT-5.4 Mini.

## Objective

Update feature and FR docs after implementation so the accepted OCR architecture is the documented source of truth.

## Files Likely Touched

- `docs/issues/FR-016.md`
- `docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md`
- `docs/features/ReliableScannedPdfOcrFallback.md`
- Session summary files under this orchestrator directory

## Dependencies

- Tasks 05 through 08 complete.

## Acceptance Criteria

- FR-016 no longer claims OpenRouter/Gemma is the accepted production OCR fallback.
- Page-selection docs describe provider-backed OCR and selected-page indexing.
- Docs mention how to disable OCR fallback safely.
- Docs mention `pnpm convex deploy` was run or why it could not be run.

## Verification Commands

- Manual docs review
