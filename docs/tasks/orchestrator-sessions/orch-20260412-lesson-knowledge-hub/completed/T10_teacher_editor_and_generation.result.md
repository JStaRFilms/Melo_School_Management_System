# T10 Teacher Editor And Generation Result

## Outcome

`T10` is complete. The teacher lesson-plan workspace at `/planning/lesson-plans` now supports source-aware draft loading, template resolution, rich-text-lite editing, autosave-backed draft persistence, revision snapshots, and AI-assisted generation for lesson plans with bounded support for student-note and assignment derivation from the same source context.

## What Changed

- replaced the placeholder lesson-plans route with a real teacher workspace in:
  - `apps/teacher/app/planning/lesson-plans/page.tsx`
- added the lesson-plan workspace UI in:
  - `apps/teacher/app/planning/lesson-plans/components/LessonPlanWorkspaceScreen.tsx`
  - `apps/teacher/app/planning/lesson-plans/types.ts`
- added the canonical teacher generation route handler in:
  - `apps/teacher/app/api/ai/lesson-plans/generate/route.ts`
- kept a compatibility route handler path in place via:
  - `apps/teacher/app/api/planning/lesson-plans/generate/route.ts`
- added Convex teacher workspace persistence and revision support in:
  - `packages/convex/functions/academic/lessonKnowledgeLessonPlans.ts`
- updated teacher package dependencies for generation-route support in:
  - `apps/teacher/package.json`

## Workspace Behavior

- selected `sourceIds` from the planning-library handoff are loaded into the lesson-plan workspace
- teacher-visible sources are validated against school-aware access rules before generation is allowed
- the workspace resolves the applicable template using the lesson-knowledge fallback rules:
  - `subject + level`
  - `subject only`
  - `level only`
  - `school default`
- the editor remains single-user and rich-text-lite via a markdown-style textarea with formatting helpers
- autosave persists draft changes without destroying the current draft on failure
- every save creates a revision snapshot in Convex
- AI generation uses the selected source set and resolved template context only
- the same workspace can switch between:
  - `lesson_plan`
  - `student_note`
  - `assignment`
- generated outputs remain editable after generation
- AI run logging now records success/failure metadata for teacher generation actions

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `pnpm -C packages/shared typecheck`
- `pnpm -C apps/teacher typecheck`
- `pnpm -C apps/teacher lint`

## Notes

- Teacher lint still reports the pre-existing unrelated warnings in the exam-entry area; there are no new T10 lint errors.
- The canonical blueprint route `/api/ai/lesson-plans/generate` is now implemented and used by the teacher workspace.
- The current generation handler is request/response based rather than token-streaming in the UI. Output remains editable and persisted, but token-by-token streaming polish can be revisited later if needed.
- This task does not include question-bank or CBT generation; those remain in `T11`.
