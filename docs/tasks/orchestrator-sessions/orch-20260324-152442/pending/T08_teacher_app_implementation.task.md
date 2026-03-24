# T08 Teacher App Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the teacher-side Exam Recording v1 UI.

## Scope

Included:
- teacher route structure
- selection flow
- roster grid
- inline validation
- exam mode indicator
- scaled contribution display when applicable
- save/update flow
- loading, empty, error, and saved states
- targeted UI tests

Excluded:
- admin settings pages
- backend domain design beyond calling shared logic

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/tasks/ExamRecording_TeacherAppBuild.md`
- `docs/mockups/teacher/`
- `docs/Coding_Guidelines.md`

## Definition Of Done

- The teacher entry experience matches the approved mockup and feature doc.
- The UI is mobile-first and practical for repeated data entry.

## Expected Artifacts

- Teacher-app routes, components, and tests

## Constraints

- Reuse shared logic from packages; do not import from other apps.
- Keep data-entry interactions fast and readable.

## Verification

- Confirm `/40` and `/60` display modes both render correctly.
- Confirm invalid values block save with clear inline feedback.
