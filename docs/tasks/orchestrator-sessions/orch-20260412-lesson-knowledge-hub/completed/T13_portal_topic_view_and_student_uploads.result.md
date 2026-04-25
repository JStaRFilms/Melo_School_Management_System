# T13 Portal Topic View And Student Uploads Result

## Outcome

`T13` is complete. The portal now has its first student-facing lesson-knowledge route at `/learning/topics/[topicId]`, with approved topic-resource rendering, class-scoped supplemental student uploads, and a teacher-side promotion flow for student uploads once review conditions are met.

## What Changed

### Portal route and UI
- Added the portal topic route:
  - `apps/portal/app/(portal)/learning/topics/[topicId]/page.tsx`
- Added the client topic page implementation:
  - `apps/portal/app/(portal)/learning/topics/[topicId]/topic-page.tsx`
- The topic page now:
  - loads topic metadata
  - renders only approved, class-eligible content
  - shows approved topic resources including YouTube links
  - allows class-matching students to submit supplemental uploads for review

### Convex portal backend
- Added the portal backend module:
  - `packages/convex/functions/academic/lessonKnowledgePortal.ts`
- Implemented:
  - `getPortalTopicPageData`
  - `requestPortalSupplementalUploadUrl`
  - `finalizePortalSupplementalUpload`
  - `promotePortalStudentUpload`

### Teacher promotion flow
- Extended the teacher planning library to expose a promotion action for eligible student uploads:
  - `apps/teacher/app/planning/library/page.tsx`
- Eligible student uploads can now be promoted from:
  - `class_scoped / pending_review`
  - to `student_approved / approved`
  - once topic attachment and class scope are present

## Delivered Behavior

- `/learning/topics/[topicId]` is now the first narrow portal learning surface in v1.
- The page renders only topic-attached materials that pass portal approval checks.
- Private-owner, staff-shared, rejected, and archived materials remain hidden from portal rendering.
- Student supplemental uploads created from the topic page:
  - stay class-scoped
  - enter the review queue
  - receive both class-scope and topic-attachment bindings during creation
- Students can complete the upload flow through the portal-specific finalize mutation.
- Teachers can promote eligible student uploads from the planning library without exposing unrelated content.

## Reviewer Fixes Applied

The first implementation pass was not accepted blindly. Reviewer fixes were applied before completion:
- fixed the portal upload flow so student uploads can actually be finalized by students instead of incorrectly calling the staff-only finalize mutation
- ensured topic attachment bindings are created for supplemental uploads at creation time so later promotion is actually possible
- replaced a broken upload-eligibility heuristic based on existing approved materials with class/topic level context gating
- added a teacher-side promotion entry point in the planning library so T13 includes an actual promotion flow, not just backend plumbing
- tightened validators and return shapes to satisfy Convex type discipline

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `pnpm -C apps/portal typecheck`
- `pnpm -C apps/teacher typecheck`
- `pnpm -C apps/teacher lint`

## Notes

- Teacher lint still reports the same unrelated pre-existing warnings in the exam-entry area; there are no new T13 lint errors.
- This task intentionally keeps the portal scope narrow to `/learning/topics/[topicId]`; no portal-wide learning search or browse surface was added.
- Student uploads remain review-gated and are not auto-promoted; a teacher or admin action is still required for `student_approved` exposure.

## Post-completion follow-up fixes

A follow-up bugfix pass was applied after initial T13 completion when live testing showed that approved materials still could not be surfaced reliably on portal topic pages.

### Additional fixes
- Added a portal landing page at:
  - `apps/portal/app/(portal)/learning/topics/page.tsx`
- Added a student-safe topic index query in:
  - `packages/convex/functions/academic/lessonKnowledgePortal.ts`
- Added portal navigation discoverability via:
  - `packages/shared/src/workspace-navigation.ts`
  - `packages/shared/src/components/WorkspaceNavbar.tsx`
- Fixed the student lookup bug in portal topic queries by replacing the invalid `students.by_school_and_user` lookup with the existing school-scoped pattern.
- Added admin topic creation support in:
  - `packages/convex/functions/academic/lessonKnowledgeAdmin.ts`
- Added inline admin create-and-attach topic UX in:
  - `apps/admin/app/academic/knowledge/library/page.tsx`
  - `apps/admin/app/academic/knowledge/library/components/KnowledgeMaterialDetailPanel.tsx`
- Added backend syncing of `topic_attachment` class bindings for admin-attached materials so topic-attached `student_approved / approved` records can render on matching portal topic pages.

### New admin workflow
- Admin can now create a topic directly from the library material detail panel using the current material subject, level, and topic label.
- The new topic is created as an active school topic and immediately attached to the material.
- If the material is later moved into portal-visible state (`student_approved` + `approved`), the required topic/class bindings are synchronized for matching class levels.
