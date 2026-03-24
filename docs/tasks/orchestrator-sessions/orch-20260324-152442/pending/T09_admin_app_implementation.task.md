# T09 Admin App Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the admin-side Exam Recording v1 UI.

## Scope

Included:
- assessment settings page
- grading-band management page
- admin score-entry page
- validation UX
- targeted UI tests

Excluded:
- teacher-only pages
- moderation workflow pages

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/tasks/ExamRecording_AdminAppBuild.md`
- `docs/mockups/admin/`
- `docs/Coding_Guidelines.md`

## Definition Of Done

- Admins can manage school exam mode, grading bands, and score entry in one coherent flow.
- UI behavior matches the approved mockups and feature rules.

## Expected Artifacts

- Admin-app routes, components, and tests

## Constraints

- Keep the interface operational and trustworthy.
- Make broken grading-band rules visible before save.

## Verification

- Confirm grading-band validation states are represented in the implementation.
- Confirm admin score-entry honors the same calculation rules as the teacher UI.
