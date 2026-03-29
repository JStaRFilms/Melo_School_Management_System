# Archived Record Restore Flow

## Goal

Make archive behave like reversible delete for academic setup records.

Admins should be able to restore archived subjects, teachers, classes, and sessions from the archive page, and create flows should clearly tell them when the thing they are trying to create already exists in archives.

## Components

### Client

- `apps/admin/app/academic/archived-records/page.tsx`
  - add restore action for archived academic records
  - show success and failure feedback when restore is attempted
- `apps/admin/app/academic/archived-records/components/ArchivedRecordDrawer.tsx`
  - present the restore action from the details drawer
- `apps/admin/app/academic/subjects/page.tsx`
  - surface a clear validation message when a subject code is already active
  - tell the user to check archives when the blocked record is archived
- `apps/admin/app/academic/teachers/page.tsx`
  - surface a clear validation message when a teacher email is already active or archived

### Server

- `packages/convex/functions/academic/academicSetup.ts`
  - add restore mutations for archived sessions, classes, teachers, and subjects
  - keep duplicate checks strict when a matching archived record should be restored instead of recreated
- `packages/convex/functions/academic/archiveRecords.ts`
  - preserve archived subjects in history views
- `packages/convex/schema.ts`
  - no schema changes expected for this fix

## Data Flow

1. Admin archives a subject, teacher, class, or session.
2. The record stays in the database with `isArchived = true`.
3. The archived record disappears from active setup flows.
4. Admin opens the archive page and restores the record when needed.
5. If the admin tries to create a new record that matches an archived one, the server returns a restore-first error.
6. The archive page keeps the old history visible until the record is restored or intentionally left archived.

## Database Schema

No schema changes are required for the immediate fix.

The existing archive fields already support this flow:

- `isArchived`
- `archivedAt`
- `archivedBy`

## Notes

- The important behavior change is that archived records are now explicitly restorable.
- Creation errors should point admins to the archives instead of making them guess why a record failed.
