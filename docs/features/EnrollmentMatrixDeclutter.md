# Enrollment Matrix Declutter

## Goal
Simplify the admin and teacher enrollment matrix screens so every visible control has a clear purpose, dead buttons are removed or wired properly, and auto-save behavior is communicated with lightweight notifications instead of large permanent status blocks.

## Components

### Client
- `apps/admin/app/academic/students/page.tsx`
- `apps/admin/app/academic/students/components/FloatingNotice.tsx`
- `apps/admin/app/academic/students/components/EnrollmentFilters.tsx`
- `apps/admin/app/academic/students/components/StudentCreationForm.tsx`
- `apps/admin/app/academic/students/components/SubjectSelectionMatrix.tsx`
- `apps/teacher/app/enrollment/subjects/page.tsx`
- `apps/teacher/app/enrollment/subjects/components/FloatingNotice.tsx`
- `apps/teacher/app/enrollment/subjects/components/EnrollmentFilters.tsx`
- `apps/teacher/app/enrollment/subjects/components/SubjectSelectionMatrix.tsx`
- Extracted enrollment UI components to reduce page size and keep each file focused
- Small local notification pattern for save/add-success feedback

### Server
- Reuse existing Convex enrollment mutations and queries
- No new backend write flow unless a truly separate "commit" workflow is introduced later

## Data Flow
1. User opens the enrollment matrix for a class and session.
2. The client loads classes, sessions, and the class student-subject matrix.
3. Admin may add a student immediately from the roster form.
4. Admin or teacher toggles a subject tick for a student.
5. The client calls `setStudentSubjectSelections` immediately.
6. Convex persists the updated selection set right away.
7. The UI shows a short-lived success/error notice instead of a large inline banner.

## Database Schema

### Existing tables used
- `classes`
  - source of selected class context
- `academicSessions`
  - source of selected session context
- `students`
  - roster membership for the selected class
- `users`
  - student display names
- `subjects`
  - class subject metadata
- `classSubjects`
  - determines which subjects can appear in the matrix
- `studentSubjectSelections`
  - stores the actual enrollment ticks
- `teacherAssignments`
  - controls teacher access to class enrollment editing

### Schema changes
- None planned for this cleanup

## Current Findings
- Subject tick changes already auto-save through `setStudentSubjectSelections`.
- `Commit Enrollment` is a dead button on both admin and teacher screens.
- `Reset Grid` only clears transient messages; it does not reset the grid.
- Admin header buttons `Roster View` and top-level `Add Student` are currently decorative and have no handlers.
- Large inline success/state cards repeat information that the page already knows and crowd the screen.
- The admin page is 538 lines and the teacher page is 375 lines, so both should be split into smaller focused components.

## Proposed Cleanup
- Remove dead footer action bars unless we introduce a real staged-edit workflow.
- Keep one clear roster action:
  - admin: anchor or focus the add-student form
  - teacher: no add-student CTA
- Replace persistent "save state" and "grid updated" panels with compact transient notices.
- Convert the validation block into concise contextual help only when there is a real issue.
- Rename or remove any control whose behavior is not obvious from the UI.
- Extract shared matrix table and notice components so the pages drop below the current monolithic size.

## Implemented Outcome
- Removed the dead admin footer actions and teacher footer action from the enrollment routes.
- Removed decorative status cards and replaced them with compact top-right transient notices.
- Kept a single real admin roster CTA that scrolls to the add-student form.
- Updated both screens to explain that subject ticks save instantly.
- Reduced the teacher page below the previous monolith size and split the admin screen into focused route-local components.

## Regression Checks
- Admin can still create a student in the selected class.
- Admin and teacher can still toggle subject selections and see errors if a write fails.
- Teacher cannot add students.
- Class/session switching still reloads the correct matrix.
- Empty states for no class, no students, or no subjects remain clear.

## Verification Notes
- Text sweep confirms the old dead labels were removed from both route folders.
- Full app typecheck remains blocked by a pre-existing shared-package export collision in `packages/shared/src/index.ts` for `ExamInputMode`.
