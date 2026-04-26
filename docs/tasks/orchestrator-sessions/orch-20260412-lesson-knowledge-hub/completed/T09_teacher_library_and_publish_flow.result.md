# T09 Teacher Library And Publish Flow Result

## Outcome

`T09` is complete. The teacher library surface now exists at `/planning/library` and supports private-first uploads, label editing, scoped search/filtering, explicit publish-to-staff, and deterministic source handoff into the future lesson-plan route.

## What Changed

- added a new teacher planning route shell and workspace layout:
  - `apps/teacher/app/planning/layout.tsx`
  - `apps/teacher/app/planning/page.tsx`
  - `apps/teacher/app/planning/lesson-plans/page.tsx`
- added the teacher library surface:
  - `apps/teacher/app/planning/library/page.tsx`
- updated the teacher workspace navigation so the new planning lane appears in the shared teacher navbar:
  - `packages/shared/src/workspace-navigation.ts`
  - `packages/shared/src/components/WorkspaceNavbar.tsx`
- added a shared planning-route helper for deterministic query-state handoff into the future lesson-plan workspace:
  - `packages/shared/src/planning-routes.ts`
- added Convex teacher-library queries and mutations with school-scoped auth and strict validators:
  - `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- extended the knowledge access helpers with a lesson-source eligibility check:
  - `packages/convex/functions/academic/lessonKnowledgeAccess.ts`
- added focused tests for the lesson-source eligibility helper and lesson-plan handoff helper:
  - `packages/convex/functions/academic/__tests__/lessonKnowledgeAccess.test.ts`
  - `packages/shared/src/__tests__/planning-routes.test.ts`
- refreshed Convex generated bindings after adding the new functions:
  - `packages/convex/_generated/api.d.ts`

## Teacher Library Capabilities

- upload source files privately by default
- keep new uploads in `private_owner` until an explicit publish action
- edit title, subject, level, topic label, and description for owned materials
- search and filter materials within the teacher’s school scope
- select ready materials as lesson-plan sources
- publish owned private materials to `staff_shared` explicitly
- hand off selected source ids through a deterministic `sourceIds` query string for the future lesson-plan route

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `pnpm -C packages/shared typecheck`
- `pnpm -C apps/teacher typecheck`

## Notes

- I also attempted `pnpm -C apps/teacher lint`, but the current script uses `--ext`, which ESLint 9 no longer accepts. The TypeScript checks passed, and the lint script failure appears to be a repo-level config issue rather than a regression in this task.
- Scope stayed locked to T09; the lesson-plan editor and question-bank editor were not implemented.
