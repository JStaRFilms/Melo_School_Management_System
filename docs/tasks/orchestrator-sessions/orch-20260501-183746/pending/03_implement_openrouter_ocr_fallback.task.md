# Task: Implement OpenRouter OCR fallback

**Task ID:** 03
**Stage:** build
**Status:** pending
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-03
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4

## Context

Parent session: orch-20260501-183746

Task title: Implement OpenRouter OCR fallback

## Objective

Replace the old Gemini/Gemma/cloudflare-ai fallback with the OpenRouter `file-parser` plugin using the explicit `mistral-ocr` PDF engine. Keep `OPENROUTER_OCR_MODEL` environment handling for the chat model that receives parsed OCR text, and ensure selected-page retries use the stored selected-pages PDF buffer without passing stale original page indices into extraction.

## Scope

- packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts
- packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts
- packages/convex/functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts
- docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md
- docs/issues/FR-016.md

## Checklist

- No checklist yet.

## Definition of Done

- OpenRouter `file-parser` + `mistral-ocr` engine path implemented for stored-PDF OCR.
- `OPENROUTER_OCR_MODEL`, `OPENROUTER_PDF_ENGINE`, and API key handling are documented and configurable.
- Gemini/Gemma/cloudflare-ai fallback naming is removed or clearly marked as historical compatibility context.
- Selected-page OCR fallback uses the selected-pages PDF buffer and preserves original selected page metadata in chunks.
- Tests cover OpenRouter success, failure, timeout/rate-limit behavior, and selected-page retry behavior.
- SmartPdfPageSelectionAndPageAwareIndexing and FR-016 docs are updated.

## Expected Artifacts

- None specified.

## Dependencies

- Design OpenRouter OCR provider strategy

## Review Checkpoint

Review before implementation handoff or final completion.

## Instructions

- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
