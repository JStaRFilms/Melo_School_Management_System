# Task: High-impact global error replacement

**Task ID:** 06
**Stage:** build
**Status:** pending
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-06
**Workflow:** vibe-build
**Model Override:** gpt-5.4

## Context

Parent session: orch-20260428-204715

Task title: High-impact global error replacement

## Objective

Replace obvious scattered global operation errors with the shared toast API.

## Scope

- apps/admin/app/sign-in/page.tsx
- apps/teacher/app/sign-in/page.tsx
- apps/platform/app/sign-in/page.tsx
- apps/platform/app/schools/create/page.tsx
- apps/platform/app/schools/[schoolId]/assign-admin/page.tsx
- apps/teacher/app/planning/lesson-plans/page.tsx
- apps/teacher/app/planning/question-bank/page.tsx
- apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx

## Checklist

- [ ] Read docs/features/unified-toast-system.md
- [ ] Inspect each target file before editing
- [ ] Refactor admin sign-in global errors
- [ ] Refactor teacher sign-in global errors
- [ ] Refactor platform sign-in global errors
- [ ] Refactor platform school creation global errors
- [ ] Refactor platform assign-admin global errors
- [ ] Refactor teacher lesson-plans workspace errors
- [ ] Refactor teacher question-bank workspace errors
- [ ] Replace BandsActionBar manual fixed popup
- [ ] Use getErrorMessage for unknown caught errors
- [ ] Avoid direct Sonner imports outside shared module
- [ ] Keep visual/styling choices out of page/component call sites
- [ ] Use consistent success/error/warning/info semantics from the blueprint
- [ ] Run tsc --noEmit after each TS/TSX edit
- [ ] Document verification result

## Definition of Done

- Global operation failures use appToast
- Manual fixed popup in BandsActionBar is removed/replaced
- Useful local state is not removed where still needed for logic
- User-facing error messages are detailed where possible
- Migrated files use the system API only; toast appearance remains owned by AppToaster

## Expected Artifacts

- Updated high-impact page/component files

## Dependencies

- 04
- 05

## Review Checkpoint

Reviewer checks behavior, message quality, and regression risk.

## Instructions

- Do not blindly remove inline validation summaries
- Use getErrorMessage for unknown caught errors
- Avoid direct Sonner imports outside shared toast module
- Do not pass ad hoc class names/styles from call sites unless approved in docs/features/unified-toast-system.md
