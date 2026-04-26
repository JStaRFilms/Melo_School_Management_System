# T12 Video Links And Approval Result

## Outcome

`T12` is complete. Teachers now have a dedicated YouTube submission route at `/planning/videos`, and admins can review YouTube knowledge materials inside the existing admin library console with explicit topic attachment support for later portal exposure.

## What Changed

### Teacher route and UI
- Added the teacher video-submission route:
  - `apps/teacher/app/planning/videos/page.tsx`
- Teachers can now:
  - submit a YouTube URL
  - provide title and optional description
  - choose subject and school-scoped level context
  - provide topic label context
  - track current visibility / review / processing state for submitted links

### Teacher backend support
- Added a focused teacher query for YouTube submissions:
  - `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
- The new query reuses the existing teacher knowledge-material domain and filters to:
  - `sourceType: "youtube_link"`

### Admin review integration
- Added admin topic-list query support for topic attachment UX:
  - `packages/convex/functions/academic/lessonKnowledgeAdmin.ts`
- Extended the admin knowledge-library page to load topic options and pass them into the detail panel:
  - `apps/admin/app/academic/knowledge/library/page.tsx`
- Extended the admin material detail panel so admins can:
  - attach a topic to a YouTube knowledge material
  - approve or reject it through the existing state controls
  - keep portal-hidden-until-approved behavior intact
  - files touched:
    - `apps/admin/app/academic/knowledge/library/components/KnowledgeMaterialDetailPanel.tsx`

### Navigation
- Added teacher navigation support for the new planning route:
  - `packages/shared/src/workspace-navigation.ts`

## Delivered Behavior

- Teachers can submit YouTube links through `/planning/videos`.
- Submitted links remain inside `knowledgeMaterials` with:
  - `sourceType: "youtube_link"`
- Teacher submissions use the existing review flow and can enter `pending_review`.
- Admins can inspect YouTube submissions in the admin library console and attach them to a topic.
- Portal-hidden-until-approved behavior remains intact because student-facing visibility still requires explicit approval plus topic attachment.

## Reviewer Fixes Applied

The first implementation pass was reviewed before acceptance. Reviewer fixes included:
- switching the teacher video form from free-text level input to the same school-scoped level-option pattern used elsewhere in planning
- exposing the new route cleanly in teacher planning navigation
- removing new T12-specific lint warnings from the page component

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `pnpm -C apps/admin typecheck`
- `pnpm -C packages/shared typecheck`
- `pnpm -C apps/teacher typecheck`
- `pnpm -C apps/teacher lint`

## Notes

- Teacher lint still reports the same unrelated pre-existing warnings in the exam-entry area; there are no new T12 lint errors.
- This task delivers admin review integration through the existing library console rather than a separate dedicated `/academic/knowledge/review` screen.
- Portal topic rendering itself remains out of scope for `T12`; that remains for the later portal task.
