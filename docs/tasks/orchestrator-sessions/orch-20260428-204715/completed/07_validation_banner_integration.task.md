# Task: Validation banner integration
**Task ID:** 07
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-07
**Workflow:** vibe-build
**Model Override:** gpt-5.4
## Context
Parent session: orch-20260428-204715

Task title: Validation banner integration
## Objective
Apply the validation UX policy to validation-heavy pages without losing detailed inline guidance.
## Scope
- apps/admin/app/assessments/results/entry/page.tsx
- apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx
- apps/admin/app/assessments/setup/grading-bands/components/BandValidationBanner.tsx
## Checklist
- [x] Read validation UX policy from docs/features/unified-toast-system.md
- [x] Inspect assessment results entry validation flow
- [x] Inspect teacher exam entry validation flow
- [x] Inspect grading bands validation banner flow
- [x] Add toast alert only where validation blocks submit/save
- [x] Preserve inline field/table/row validation details
- [x] Avoid duplicate noisy error messaging
- [x] Run tsc --noEmit after each TS/TSX edit
- [x] Document verification result
## Definition of Done
- Validation blocking actions trigger appropriate toast alerts where useful
- Detailed inline validation remains where needed
- No duplicate noisy error surfaces are introduced
## Expected Artifacts
- Updated validation-heavy pages/components
## Dependencies
- 03
- 04
- 05
## Review Checkpoint
Designer/reviewer confirms validation UX is clear and non-regressive.
## Instructions
- Preserve row/field-level correction guidance
- Use toast for awareness when submit/save is blocked
- Do not convert every validation detail into a toast
## Notes
Task 07 completed by coder subagent using oauth-router/gpt-5.4, reviewed by orchestrator. Added appToast.warning only for explicit blocked save/submit and partial-save outcomes in admin results entry and teacher exam entry. Preserved field/table/row validation banners and grid details; removed duplicate inline action-bar error result surfaces. BandValidationBanner inspected and intentionally left inline-only. Verification: pnpm --filter @school/admin typecheck passed; pnpm --filter @school/teacher typecheck passed; direct Sonner imports limited to shared toast module.