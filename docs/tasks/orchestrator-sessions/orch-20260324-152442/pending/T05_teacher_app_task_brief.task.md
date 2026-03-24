# T05 Teacher App Task Brief

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-spawnTask`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-spawnTask`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Create a self-contained implementation brief for the teacher app portion of Exam Recording v1.

## Scope

Included:
- teacher route structure
- selection flow
- roster grid UI
- inline validation
- exam mode rendering
- computed columns
- save/update behavior
- loading and empty states
- tests

Excluded:
- admin settings UI
- backend domain design beyond consuming shared logic

## Context

Use:
- `docs/features/ExamRecording.md`
- teacher mockups in `docs/mockups/teacher/`
- `docs/Coding_Guidelines.md`

## Definition Of Done

- A detailed task brief exists in `docs/tasks/`.
- The brief can be handed to a build agent without extra discovery.

## Expected Artifacts

- `docs/tasks/ExamRecording_TeacherAppBuild.md`

## Constraints

- The brief must enforce shared-package reuse.
- The brief must preserve mobile-first behavior.

## Verification

- Confirm score-entry states are included.
- Confirm the `/60` scaled contribution display is included.
