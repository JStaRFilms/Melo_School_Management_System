# Student Archive Restore

## Goal
Allow admins to archive students without deleting their records, and restore them later from the archived records page when the student should return to active academic workflows.

## Components

### Client
- `apps/admin/app/academic/students/page.tsx`
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
- `apps/admin/app/academic/archived-records/page.tsx`
- `apps/admin/app/academic/archived-records/components/ArchivedRecordsFilters.tsx`
- `apps/admin/app/academic/archived-records/components/ArchivedRecordsList.tsx`
- `apps/admin/app/academic/archived-records/components/types.ts`

### Server
- `packages/convex/functions/academic/studentEnrollment.ts`
- `packages/convex/functions/academic/archiveRecords.ts`

## Data Flow
1. Admin opens a student profile from the enrollment page.
2. Admin chooses `Archive Student` and confirms the action.
3. `archiveStudent` marks both the `students` row and the linked `users` row as archived instead of deleting them.
4. Active student workflows stop showing the archived student:
   - class enrollment matrix
   - student subject editing
   - profile editing
   - assessment-entry rosters
5. Historical links remain intact:
   - subject selections
   - assessment records
   - report-card data
6. Archived student records appear on the archive page with restore metadata and history counts.
7. Admin restores the student from the archive page through `restoreStudent`.
8. Restore clears the archive flag on both the `students` row and linked `users` row so the student returns to active workflows.

## Database Schema

### Existing tables used
- `students`
  - already contains `isArchived`, `archivedAt`, and `archivedBy`
- `users`
  - already contains `isArchived`, `archivedAt`, and `archivedBy`
- `studentSubjectSelections`
- `assessmentRecords`

### Schema changes
- None required

## Duplicate Handling
- Creating a student with an admission number that belongs to an active student still fails with the existing duplicate message.
- Creating or updating a student to an admission number that belongs to an archived student now fails with:
  - `This failed because the student was previously archived. Check the archives.`
- Restoring a student is blocked if another active student already uses the same admission number.

## Regression Checks
- Active students still appear in enrollment and assessment workflows.
- Archived students no longer appear in live student rosters.
- Historical report-card generation still works for archived students.
- Archived students can be restored from the archive page.
- Student archive actions do not remove linked subject selections or assessment records.

## Implemented Outcome
- Student records now use archive/restore instead of destructive deletion.
- The admin student profile editor now exposes an archive action.
- The archive page now lists archived students alongside the other archived academic records.
- Student duplicate errors now explain when the conflict is caused by a previously archived student.
