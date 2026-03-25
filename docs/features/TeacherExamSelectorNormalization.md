# Teacher Exam Selector Normalization

## Goal

Restore the teacher exam-entry selector flow so teachers can reliably see assigned classes and subjects in live Convex mode, including schools that assign a teacher as the class form teacher before subject-level teacher mapping is completed.

## Components

### Client

- `apps/teacher/app/assessments/exams/entry/page.tsx`
- `apps/teacher/app/assessments/exams/entry/components/SelectionBar.tsx`

### Server

- `packages/convex/functions/academic/teacherSelectors.ts`

## Data Flow

1. The teacher exam-entry page loads session and class options from teacher selector queries.
2. The shared `SelectionBar` expects every option in the shape `{ id, name }`.
3. The live teacher selectors currently return sessions and classes as `{ _id, name }`.
4. When the `<option value>` receives `undefined`, the browser falls back to the visible label text.
5. The next term query then sends a session name like `2025/2026 Academic Session` instead of `Id<"academicSessions">`, which triggers Convex argument validation.
6. Teacher class and subject options must be sourced from explicit `teacherAssignments` rows, legacy `classSubjects.teacherId` links, and `classes.formTeacherId` for form-teacher-led class ownership.
7. When a teacher is the form teacher for a class, the teacher flows should expose the class and its offered subjects even if subject-level teacher mapping has not been completed yet.
8. The fix is to normalize live teacher session and class results into `{ id, name }` before passing them into the shared selector UI, while the backend authorization helper accepts all supported assignment sources.

## Database Schema

No schema change.

- `academicSessions._id` remains the source of truth for session selection.
- `classes._id` remains the source of truth for class selection.
- `teacherAssignments.teacherId` remains the preferred assignment source.
- `classSubjects.teacherId` is treated as a compatibility source for schools that still persist teacher links there.
- `classes.formTeacherId` is treated as a class-level fallback source for teacher access in primary-style workflows.

## Regression Check

- Teacher exam entry must pass real Convex document ids through the URL search params.
- Term and subject selectors must continue to use `{ id, name }`.
- Teacher enrollment subject selection is not changed because it already consumes `_id` directly and does not use the shared exam selector component.
