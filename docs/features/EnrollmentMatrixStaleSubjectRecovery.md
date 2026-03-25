# Enrollment Matrix Stale Subject Recovery

## Goal
Prevent student enrollment saves from crashing when a class subject offering changes after a student was already checked for the older subject. The system should quietly reconcile stale selections and show normal product-language feedback instead of raw Convex error envelopes.

## Components

### Client
- `apps/admin/app/academic/students/page.tsx`
- `apps/teacher/app/enrollment/subjects/page.tsx`
- Shared UI error formatting from `@school/shared`

### Server
- `packages/convex/functions/academic/academicSetup.ts`
- `packages/convex/functions/academic/studentEnrollment.ts`

## Data Flow
1. Admin updates the subjects offered by a class.
2. If a subject is removed from the active class offering, the backend deletes matching active-session student subject selections for that class.
3. When the enrollment matrix loads, it filters out any stale subject selections that no longer belong to the visible class offering.
4. When an admin or teacher toggles a subject, the backend accepts the new valid subject set and ignores stale legacy subject ids that only survived from older saved selections.
5. If the client still hits a real write failure, the UI shows a clean message without Convex request metadata.
6. Teacher authorization checks now accept explicit `teacherAssignments` rows, legacy `classSubjects.teacherId` links, and `classes.formTeacherId` when the teacher is allowed to edit a class.

## Database Schema

### Existing tables used
- `classSubjects`
  - source of truth for the current class offering
- `academicSessions`
  - active session used for cleanup when class offerings change
- `studentSubjectSelections`
  - reconciled when a subject is removed from a class
- `students`
  - validated against the selected class during enrollment saves
- `teacherAssignments`
  - preferred teacher-to-class/subject assignment source
- `classSubjects`
  - compatibility source for legacy teacher-to-class links in the teacher workspace
- `classes`
  - form teacher fallback source for class-level teacher ownership

### Schema changes
- None

## Regression Checks
- Removing a class subject no longer leaves the enrollment matrix in a broken state for students already checked against the removed subject.
- Toggling a different subject after a class subject split no longer replays hidden stale subject ids.
- Admin and teacher enrollment screens still save valid subject changes immediately.
- Users no longer see raw `[CONVEXM(...)]` style messages in enrollment notices.
- Active-session enrollment remains aligned with the current class subject offering.

## Notes
- The current data model stores class subject offerings without session history. This fix keeps active enrollment stable and user-friendly without widening scope into a larger academic-history redesign.
- Teacher-side class access now uses the same compatibility rule as the exam selector flow, so schools that rely on `classSubjects.teacherId` or only assign a form teacher during class setup do not lose teacher editing access.
