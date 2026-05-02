# Task: Teacher Upload UI Page Range UX

**Task ID:** T03
**Stage:** build
**Status:** completed
**Role:** design
**Preferred Agent:** designer
**Conversation ID:** designer-T03
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4

## Context

Parent session: orch-20260430-193734

Task title: Teacher Upload UI Page Range UX

## Objective

Add teacher upload UI controls and display selected page summary.

## Scope

- apps/teacher/app/planning/library/page.tsx
- apps/teacher/features/planning-library/components/LibrarySidebar.tsx
- apps/teacher/features/planning-library/types.ts
- apps/teacher/features/planning-library/components/MaterialPreviewInspector.tsx

## Checklist

- [x] Teacher upload sidebar has optional PDF page-range input
- [x] Upload handler sends ranges only for PDFs
- [x] Material inspector displays indexed page summary

## Definition of Done

- PDF uploads can include page ranges
- UI explains selected pages are the only indexed content
- Material detail shows indexed page summary

## Expected Artifacts

- None specified.

## Dependencies

- None specified.

## Review Checkpoint

Review before implementation handoff or final completion.

## Instructions

- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains

## Notes

Teacher planning library upload UX now supports page ranges like 1-5,7-8,70-72 and explains only selected pages are indexed.
