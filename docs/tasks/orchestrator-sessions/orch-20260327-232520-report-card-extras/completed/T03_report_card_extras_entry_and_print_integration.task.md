# T03 Report Card Extras Entry And Print Integration

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi` and `nextjs-standards`.
- Do not begin until `T00` is approved and `T01` is complete.

## Objective

Build the teacher/admin extras-entry workspace and integrate printable extras into existing report-card flows.

## Write Scope

- `apps/teacher/app/assessments/report-card-extras/**`
- `apps/admin/app/assessments/report-card-extras/**`
- existing report-card pages/components that surface extras
- `packages/shared/src/components/ReportCardSheet.tsx` and directly related shared report-card files

## Responsibilities

- session/term/class/student extras entry flow
- form-teacher-only edit enforcement with admin override
- empty-state handling when no bundles are assigned
- report-card rendering and full-class print support for extras

## Definition Of Done

- teacher can edit only allowed extras for the selected class
- admin can access the same workspace as an override path
- single-student and full-class print include extras when present
- current report-card behavior still works when no extras exist
