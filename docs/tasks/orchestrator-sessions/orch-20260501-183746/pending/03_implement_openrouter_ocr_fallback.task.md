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
Replace Gemini-specific OCR fallback with OpenRouter multimodal OCR using google/gemma-4-31b-it:free and fix selected-page OCR fallback.
## Scope
- packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts
- packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts
- packages/convex/functions/academic/__tests__/lessonKnowledgeIngestionHelpers.test.ts
- docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md
- docs/issues/FR-016.md
## Checklist
- No checklist yet.
## Definition of Done
- OpenRouter model constants/env handling implemented
- Gemini naming removed or compatibility noted
- Selected-page OCR fallback uses selected-pages PDF buffer
- Tests updated for OpenRouter success/fail/rate-limit behavior
- Docs updated
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