# Task: Design OpenRouter OCR provider strategy

**Task ID:** 02
**Stage:** build
**Status:** pending
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-02
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.5

## Context

Parent session: orch-20260501-183746

Task title: Design OpenRouter OCR provider strategy

## Objective

Review current Convex PDF/OCR ingestion and propose a minimal, safe OpenRouter multimodal provider abstraction using google/gemma-4-31b-it:free.

## Scope

- packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts
- packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts
- docs/issues/FR-016.md

## Checklist

- No checklist yet.

## Definition of Done

- Identify exact code changes
- Preserve native PDF parser-first behavior
- Ensure selected-page image PDFs can use OpenRouter fallback
- Define graceful failure statuses

## Expected Artifacts

- None specified.

## Dependencies

- None specified.

## Review Checkpoint

Review before implementation handoff or final completion.

## Instructions

- Do not edit files; return implementation plan and risks.
- Account for missing runtime OPENROUTER_API_KEY verification in local shell.
