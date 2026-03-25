# Task Completion Summary: Admin Academic Setup and Enrollment Implementation (`T16`)

**Completed At:** `2026-03-25`  
**Workflow:** `/vibe-build`

## Verdict

`T16` passes after implementation fixes and a full verification sweep.

The original work had the right feature direction, but it still contained live-flow blockers:
- teacher creation was using a fake `authId` instead of creating a real Better Auth-backed teacher account
- class management had no real form-teacher workflow and did not surface accurate offerings or roster counts
- student creation was storing the current admin as the student `userId`
- teacher selectors returned the wrong identifier shape for the teacher enrollment screen
- admin and teacher enrollment grids were still rendering incomplete student identity data

Those issues are now corrected.

## Implemented

### Backend

- `packages/convex/schema.ts`
  - classes now support `formTeacherId`
- `packages/convex/functions/academic/academicSetup.ts`
  - real teacher provisioning via Better Auth-backed action
  - internal user-row creation for teachers
  - session and term management retained and verified
  - class creation now supports form teachers
  - class listing now returns form-teacher names, subject previews, and student counts
  - class updating now supports form-teacher changes and clean removal
  - class subject resets now clear stale teacher assignments
  - subject-teacher assignment now replaces prior assignment for the same class-subject pair
- `packages/convex/functions/academic/studentEnrollment.ts`
  - student creation now creates a dedicated linked `users` row
  - student listings and class matrices now return `studentName`
  - student updates patch the linked user name correctly
  - student deletion cleans up the linked user row
- `packages/convex/functions/academic/teacherSelectors.ts`
  - teacher selector queries now return `_id` shapes expected by the UI

### Admin App

- `apps/admin/app/academic/teachers/page.tsx`
  - real teacher account provisioning UI with temporary password handling
- `apps/admin/app/academic/sessions/page.tsx`
  - live session and term setup flow aligned to the approved mockup direction
- `apps/admin/app/academic/subjects/page.tsx`
  - subject catalog rebuilt into the approved academic-setup visual language
- `apps/admin/app/academic/classes/page.tsx`
  - class builder now supports:
    - class creation
    - form-teacher assignment
    - subject-offering selection
    - subject-teacher assignment
    - accurate subject previews and student counts
- `apps/admin/app/academic/students/page.tsx`
  - admin-only student creation plus live enrollment matrix with real student names

### Teacher App

- `apps/teacher/app/enrollment/subjects/page.tsx`
  - live teacher enrollment grid aligned with the approved permission model
- `apps/teacher/lib/convex-runtime.ts`
  - runtime helper normalized to the callable form used across the teacher app
- `apps/teacher/lib/AuthProvider.tsx`
  - live-mode checks updated to use the callable runtime helper
- `apps/teacher/app/assessments/exams/layout.tsx`
  - runtime guard checks updated to the same helper contract

## Permission Split Verified

- Admin can create teachers.
- Admin can create sessions and terms.
- Admin can create subjects.
- Admin can create classes and assign form teachers.
- Admin can add students to classes.
- Admin can edit student subject selections.
- Assigned teachers can edit student subject selections for their classes.
- Teachers cannot create students.

## Verification

- `pnpm --filter @school/convex typecheck`
- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/teacher typecheck`
- `pnpm test`
- `pnpm --filter @school/admin build`
- `pnpm --filter @school/teacher build`

All passed.

## Ready For

- school bootstrap for the first real admin account
- `T10` final verification/docs sync/review
- later `T17` platform super-admin provisioning

## Notes

- Existing orchestration work already provided the academic layout shell and some page direction; this completion pass tightened the live data model, auth-backed teacher provisioning, and mockup alignment so the slice is now usable for a real school setup flow.
