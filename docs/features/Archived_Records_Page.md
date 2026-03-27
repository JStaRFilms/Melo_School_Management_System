# Feature: Archived Records Page (Admin)

## Goal
Provide a dedicated admin view for browsing archived subjects, classes, teachers, and sessions without bringing back hard-delete behavior.

## Status
Implemented.

## User Story
As a school admin, I want to inspect archived academic records in one place so I can audit when they were archived, who archived them, and what historical records still depend on them.

## Client Components

### Route
- `apps/admin/app/academic/archived-records/page.tsx`
- Client-rendered admin page using Convex `useQuery`.

### UI Building Blocks
- `apps/admin/app/academic/archived-records/components/ArchivedRecordsFilters.tsx`
  - Type tabs for `all`, `class`, `subject`, `teacher`, `session`.
  - Search input.
  - Archived-from and archived-to date filters.
- `apps/admin/app/academic/archived-records/components/ArchivedRecordsList.tsx`
  - Desktop table.
  - Mobile cards.
  - Empty state when filters return no matches.
- `apps/admin/app/academic/archived-records/components/ArchivedRecordDrawer.tsx`
  - Read-only detail panel for the selected archived record.
  - Shows archive metadata, linked history, and preserved record snapshot.
- `apps/admin/app/academic/archived-records/loading.tsx`
  - Route-level skeleton.
- `apps/admin/app/academic/archived-records/error.tsx`
  - Route-level retry state for unexpected failures.

### Navigation
- `packages/shared/src/workspace-navigation.ts`
  - Adds an `Archive Audit` admin section entry.
- `apps/admin/app/academic/classes/page.tsx`
  - Existing footer CTA now routes to the archive audit page.

## Server Components

### Query
- `packages/convex/functions/academic/archiveRecords.ts`
- Query: `listArchivedRecords`

### Responsibilities
- Authenticates the current user and enforces admin access for the school.
- Reads archived records directly from the existing academic tables instead of introducing a second archive ledger.
- Returns:
  - Summary counts.
  - A normalized list of archived sessions, classes, teachers, and subjects.
  - Archive metadata (`archivedAt`, `archivedBy`).
  - Human-readable linked history summaries.
  - Record-specific detail fields for the drawer.

## Data Flow
1. Admin opens `/academic/archived-records`.
2. The page calls `functions/academic/archiveRecords:listArchivedRecords`.
3. Convex collects school-scoped archived rows and supporting linked history counts.
4. The client renders summary cards and a unified record list.
5. Filters run client-side against the normalized query result.
6. Selecting a record opens the read-only drawer.

## Data Sources
- `users` for archived teachers and archive actor lookup.
- `academicSessions` for archived sessions.
- `classes` for archived classes.
- `subjects` for archived subjects.
- Supporting counts pulled from:
  - `academicTerms`
  - `classSubjects`
  - `teacherAssignments`
  - `students`
  - `studentSubjectSelections`
  - `assessmentRecords`

## Schema Notes
- No new table was added for this feature.
- The page relies on the existing archive fields already present on academic entities:
  - `isArchived`
  - `archivedAt`
  - `archivedBy`

## Constraints
- No restore action is exposed.
- No hard-delete action is exposed.
- Blocker snapshots are not yet persisted historically, so the drawer explains that only current metadata and linked usage can be shown.

## Verification
- `pnpm --filter @school/convex typecheck`
- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/admin test`
