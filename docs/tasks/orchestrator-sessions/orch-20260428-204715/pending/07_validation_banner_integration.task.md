# Task: Validation banner integration

**Task ID:** 07
**Stage:** build
**Status:** pending
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

- [ ] Read validation UX policy from docs/features/unified-toast-system.md
- [ ] Inspect assessment results entry validation flow
- [ ] Inspect teacher exam entry validation flow
- [ ] Inspect grading bands validation banner flow
- [ ] Add toast alert only where validation blocks submit/save
- [ ] Preserve inline field/table/row validation details
- [ ] Avoid duplicate noisy error messaging
- [ ] Keep validation toast calls on the shared appToast API
- [ ] Keep validation toast visuals centralized in AppToaster
- [ ] Run tsc --noEmit after each TS/TSX edit
- [ ] Document verification result

## Definition of Done

- Validation blocking actions trigger appropriate toast alerts where useful
- Detailed inline validation remains where needed
- No duplicate noisy error surfaces are introduced
- Validation toast behavior follows the shared system policy instead of local one-off styling

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
- Do not replace persistent validation summaries with transient-only feedback when users need correction detail
