# Task: High-impact global error replacement
**Task ID:** 06
**Stage:** build
**Status:** completed
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
- [x] Read docs/features/unified-toast-system.md
- [x] Inspect each target file before editing
- [x] Refactor admin sign-in global errors
- [x] Refactor teacher sign-in global errors
- [x] Refactor platform sign-in global errors
- [x] Refactor platform school creation global errors
- [x] Refactor platform assign-admin global errors
- [x] Refactor teacher lesson-plans workspace errors
- [x] Refactor teacher question-bank workspace errors
- [x] Replace BandsActionBar manual fixed popup
- [x] Use getErrorMessage for unknown caught errors
- [x] Avoid direct Sonner imports outside shared module
- [x] Run tsc --noEmit after each TS/TSX edit
- [x] Document verification result
## Definition of Done
- Global operation failures use appToast
- Manual fixed popup in BandsActionBar is removed/replaced
- Useful local state is not removed where still needed for logic
- User-facing error messages are detailed where possible
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
## Notes
Task 06 completed by coder subagent using oauth-router/gpt-5.4, reviewed by orchestrator. Updated the eight high-impact target files to use appToast/getErrorMessage; removed BandsActionBar manual fixed popup; preserved local success state where needed. Orchestrator follow-up verification: pnpm --filter @school/admin typecheck passed; pnpm --filter @school/teacher typecheck passed; pnpm --filter @school/platform typecheck passed. Direct Sonner import scan is limited to shared toast module.