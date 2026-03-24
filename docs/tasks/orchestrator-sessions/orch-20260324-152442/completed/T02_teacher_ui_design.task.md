# T02 Teacher UI Design

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-design`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-design`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, and `ui-ux-pro-max`.
- Do not use `context7`.

## Objective

Design the teacher-side exam-recording experience for bulk score entry.

## Scope

Included:
- teacher exam-entry mockup
- loading, empty, error, and saved states
- mobile-first layout
- roster grid design
- score-entry affordances
- `/40` vs `/60` exam-label behavior
- read-only scaled exam contribution display

Excluded:
- student-by-student entry
- ranking and report-card UI
- moderation screens

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/Project_Requirements.md`
- `docs/design/design-system.md`
- `docs/design/sitemap.md`

## Definition Of Done

- Teacher exam-entry route is represented in `docs/design/sitemap.md`.
- Mockup exists in `docs/mockups/teacher/`.
- The mockup is practical for tablet and desktop but still workable on mobile.

## Expected Artifacts

- Updated `docs/design/sitemap.md`
- Teacher mockup HTML and supporting CSS under `docs/mockups/teacher/`

## Constraints

- Prioritize speed and clarity over decoration.
- Make the exam mode obvious but not noisy.
- Treat any existing draft mockup as editable, not final.

## Verification

- Confirm the grid shows `CA1`, `CA2`, `CA3`, `Exam`, `Total`, `Grade`, and `Remark`.
- Confirm the `/60` state exposes a read-only scaled exam contribution.
- Confirm required page states are visible in the mockup.
