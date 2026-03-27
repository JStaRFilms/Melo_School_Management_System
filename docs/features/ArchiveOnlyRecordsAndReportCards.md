# Archive-Only Records And Report Cards

## Goal

Add archive-only lifecycle management for academic setup records so sensitive school data is never hard-deleted, expand student editing beyond subject selection, and introduce report-card viewing/export on both the admin and teacher apps with student photos included. This also now covers admin-managed report-card comments per student and a manual next-term start date per term.

## Why This Feature Exists

The current system still has destructive delete behavior in parts of the backend, and student management is limited to:

- adding a student
- editing subject selections
- updating only a small subset of student fields in Convex

The current exam-recording slice also stops before report-card generation. This feature closes those gaps without breaking:

- live score entry
- teacher-assigned access rules
- session history
- existing student subject selection workflows

## Scope

### In Scope

- Archive-only actions for:
  - subjects
  - sessions
  - teachers
  - classes
- Hardening pass for archive behavior so archival never strips linked academic history as a side effect
- Explicit archive blockers and user-facing errors when a record is still tied to active workflows
- Guardrails so archived records disappear from active setup and selection flows, but remain available for historical audit and report cards
- Student profile editing from admin workflows, not only subject selection
- Student photo upload and replacement
- Student report-card viewing
- Student report-card export with profile details and photo
- Admin-side report-card comment entry for each student
- Admin-side manual next-term start date entry for each term
- Report-card access in both:
  - admin app
  - teacher app

### Out Of Scope

- Permanent delete / purge UI
- Archived-records admin browser UI (this can ship as the next slice once archive-only behavior is stable)
- Parent portal report-card delivery
- Multi-term cumulative report books
- Ranking / positions / psychomotor / affective domains unless already present elsewhere
- Background PDF generation service

## Regression Guardrails

This feature must not break the existing behavior documented in:

- `docs/features/AdminAcademicSetupEnrollment.md`
- `docs/features/AdminAcademicEditingControls.md`
- `docs/features/ExamRecording.md`

Specifically:

- subject ticks still save instantly in enrollment matrices
- teachers still only access assigned classes/subjects
- exam recording remains school-scoped and term/session/class/subject aware
- historical records tied to older sessions must still be readable after archival
- archived academic entities must not silently disappear from already saved report-card history

## Components

### Client: Admin App

- `apps/admin/app/academic/subjects/page.tsx`
  - add archive action
  - show archived status / archive errors cleanly
- `apps/admin/app/academic/sessions/page.tsx`
  - add archive action for non-active sessions
  - show blockers when a session cannot be archived
- `apps/admin/app/academic/teachers/page.tsx`
  - add archive action instead of delete
  - show assignment/session blockers and success feedback
- `apps/admin/app/academic/classes/page.tsx`
  - add archive action
  - prevent archiving active classes with unresolved constraints unless rules are satisfied
- `apps/admin/app/academic/students/page.tsx`
  - expand from create + subject matrix to include student profile editing
  - add entry point to view a student report card
  - add student photo upload area
- new admin report-card route(s)
  - student list / selector
  - detailed report-card view
  - admin-only comment/date editor panel
  - export/print action

### Client: Teacher App

- existing teacher enrollment and/or assessment flows gain student-level clickthrough to report-card view
- new teacher report-card route(s)
  - view a selected student's report card
  - export/print using the same shared rendering logic as admin
- teacher-side permissions remain read/export for report cards, without giving teacher setup-edit powers outside existing scope

### Shared UI / Domain Helpers

- shared report-card data shaping and display helpers should live outside single-page files to respect the 200-line modularity rule
- shared error-to-message formatting should be reused for archive, student update, photo upload, and export flows

### Server: Convex

- `packages/convex/schema.ts`
  - add archive metadata to academic setup entities
  - add richer student profile fields
  - add student photo storage metadata
- `packages/convex/functions/academic/academicSetup.ts`
  - archive mutations and archive-aware list queries
- `packages/convex/functions/academic/studentEnrollment.ts`
  - richer student update/query support
  - photo upload support
  - archive-aware student matrix behavior
- new report-card query/action module
  - compile a single student's report-card payload from student, class, school, session, term, and assessment records
  - store admin-supplied class-teacher and head-teacher comments per student
  - store an admin-supplied `nextTermBegins` date on each academic term
  - support export-ready data for admin and teacher surfaces

## Client / Server Split

### Student Editing

#### Client

- Admin selects a student from the roster or matrix
- Admin opens a student profile editor
- Admin can update:
  - full name
  - admission number
  - class
  - gender
  - date of birth
  - guardian name
  - guardian phone
  - address
  - student photo

#### Server

- Validate school ownership for the student and any new class assignment
- Reject duplicate admission numbers
- Update linked `users` row for the student name
- Update `students` row for profile fields
- Handle photo upload metadata and replacement safely

### Archive-Only Academic Records

#### Client

- Archive buttons replace destructive delete language
- Active lists default to non-archived records
- Archived records can optionally be surfaced in a secondary filtered view later, but v1 can keep them hidden from main setup screens

#### Server

- Archive mutations patch records instead of deleting them
- Archive mutations must not silently delete linked assignments or historical relationships
- Archive queries exclude archived records by default
- Historical report-card queries may still resolve archived entities for already-saved records

### Report Cards

#### Client

- Admin and teacher can click into any student report card from their allowed context
- Shared report-card layout renders:
  - school branding
  - student identity block
  - student photo
  - session and term
  - class
  - subject results
  - totals/grade remarks already available from assessment records
- Export button opens print-friendly output so the report card can be saved/exported cleanly with the student photo visible

#### Server

- Query report-card payload by:
  - `studentId`
  - `sessionId`
  - `termId`
- Enforce access:
  - admin can view/export for any student in the school
  - teacher can only view/export students connected to their assigned class/subject context

## Data Flow

### 1. Archive Subject / Session / Teacher / Class

1. Admin clicks `Archive`.
2. Client asks for confirmation with archive wording, not delete wording.
3. Client calls archive mutation.
4. Server validates:
   - same school
   - record exists
   - record is not already archived
   - record is eligible for archival
5. Server patches archive metadata instead of deleting data.
6. Active selectors and list queries stop returning archived records.
7. Historical records still resolve archived names/details for read-only usage.

### 2. Edit Student Details

1. Admin opens a student profile panel/page.
2. Client loads full student details plus active class options.
3. Admin edits profile fields and optionally uploads/replaces photo.
4. Client requests upload URL if a new photo is selected.
5. File uploads to Convex storage.
6. Client submits profile mutation with updated fields and photo metadata.
7. Server validates and saves profile changes.
8. Student roster and report-card views refresh automatically.

### 3b. Save Report-Card Comments

1. Admin opens a student's report card in the admin app.
2. Client preloads the saved class-teacher comment and head-teacher comment for that student, session, and term.
3. Admin edits one or both fields and clicks save.
4. Server validates:
   - admin access
   - student/session/term school ownership
   - term belongs to the selected session
   - comment length stays within allowed limits
5. Server upserts the comment row and the report-card query refreshes automatically.

### 3c. Save Next-Term Start Date

1. Admin selects a date in the admin report-card panel.
2. Client sends the selected term and the chosen next-term start date.
3. Server validates:
   - admin access
   - term ownership
   - provided date is after the selected term end date
4. Server stores the date on the academic term.
5. Every report card for that term reflects the same saved date.

### 3. View Report Card

1. Admin or teacher clicks a student.
2. Client opens report-card route for selected session/term.
3. Server composes report-card payload from:
   - student profile
   - class
   - school
   - session
   - term
   - subject assessment rows
4. Client renders print-ready report-card layout with student photo.
5. If records are incomplete, the page shows a clear warning instead of failing silently.

### 4. Export Report Card

1. User clicks `Export`.
2. Client validates that report-card payload loaded successfully.
3. Client opens print/export view using the same structured report-card content.
4. User saves/prints the report card with full details and student photo.

## Database Schema

### Add Archive Metadata

Archive metadata should be added to these entities:

#### `subjects`

- `isArchived: boolean`
- `archivedAt?: number`
- `archivedBy?: id("users")`

#### `academicSessions`

- `isArchived: boolean`
- `archivedAt?: number`
- `archivedBy?: id("users")`

#### `classes`

- `isArchived: boolean`
- `archivedAt?: number`
- `archivedBy?: id("users")`

#### `users` for teacher rows

- `isArchived?: boolean`
- `archivedAt?: number`
- `archivedBy?: id("users")`

Notes:

- teacher archival happens on the teacher `users` row because teachers are stored there
- student rows are not part of this archival request and should remain separate from this change

### Expand `students`

Add profile fields needed for editable student details and report-card identity:

- `gender?: string`
- `dateOfBirth?: number`
- `guardianName?: string`
- `guardianPhone?: string`
- `address?: string`
- `photoStorageId?: string`
- `photoFileName?: string`
- `photoContentType?: string`
- `photoUpdatedAt?: number`

### Optional Query-Only Derived Fields

Report-card queries should derive, not store:

- school name
- class display name
- session name
- term name
- student display name
- subject rows for the selected term

### Add Report-Card Metadata Storage

#### `academicTerms`

- `nextTermBegins?: number`

#### `reportCardComments`

- `schoolId: id("schools")`
- `studentId: id("students")`
- `sessionId: id("academicSessions")`
- `termId: id("academicTerms")`
- `classTeacherComment?: string`
- `headTeacherComment?: string`
- `createdAt: number`
- `updatedAt: number`
- `updatedBy: id("users")`

## Archive Rules

### Subjects

- cannot be hard-deleted
- can be archived only if the system can safely remove them from active setup flows
- archived subjects must no longer appear in:
  - class subject picker
  - student subject selection matrix
  - teacher assignment selector
- historical assessment/report-card rows referencing the subject must still render correctly

### Sessions

- active session cannot be archived directly
- archived sessions disappear from active setup selectors by default
- linked historical assessment and selection records remain intact

### Teachers

- archive instead of removing teacher identity data
- archived teachers must no longer appear in assignment selectors
- teacher assignments should be cleaned up or ignored for future access checks
- existing historical attribution such as `enteredBy` / `updatedBy` must remain valid

### Classes

- archived classes disappear from active setup and live selection flows
- archived classes must remain resolvable for historical report-card reads

## Error Handling

All new flows must return user-facing errors that are specific, school-safe, and non-destructive.

### Archive Errors

- record not found
- cross-school access denied
- record already archived
- cannot archive active session
- cannot archive session with an active term
- cannot archive teacher while still assigned to active classes or subjects
- cannot archive subject while it is still attached to active class setups or live student selections
- cannot archive class while students are still enrolled
- cannot archive record that is still required by an active workflow

### Student Editing Errors

- student not found
- duplicate admission number
- invalid class reassignment
- invalid photo upload metadata
- upload completed but save failed
- stale client state where the student was changed or archived elsewhere

### Report Card Errors

- no report-card data for selected session/term
- missing assessment settings context
- missing student profile data
- unauthorized teacher access to another class
- archived linked data still resolvable for historical viewing
- comment too long
- invalid term/date pairing for next-term start

### Export Errors

- report card not fully loaded
- image unavailable
- print/export view generation failure

## Query / Mutation Additions

### Academic Setup

- `archiveSubject`
- `archiveSession`
- `archiveTeacher`
- `archiveClass`
- `deleteSubject` now routes through archive behavior instead of hard delete

### Student Profile

- `getStudentProfile`
- `updateStudent`
- `generateStudentPhotoUploadUrl`
- photo save and removal are handled through `updateStudent`

### Report Cards

- `getStudentReportCard`
- `saveStudentReportCardComments`
- `saveTermNextTermBegins`
- report-card entry comes from the existing admin and teacher assessment rosters

## UI Notes

- student cards/rows should be clickable to open report card
- photo upload area should support:
  - preview
  - replace
  - missing-photo fallback
- archive buttons should use destructive color styling but say `Archive`, not `Delete`

## File Shape / Modularity Plan

Because several existing pages are already large, implementation should be split into focused files:

- student profile form component(s)
- student photo uploader component
- report-card layout component
- report-card data hook/service
- archive action helpers per admin module where needed

This keeps us aligned with the project 200-line modularity rule.

## Acceptance Targets

- Admin can archive a subject, session, teacher, or class without losing underlying data
- Archived records no longer appear in active setup selectors
- Admin can edit student profile details beyond subjects
- Admin can upload and replace a student photo
- Admin can open a student report card
- Teacher can open a student report card within allowed access boundaries
- Admin and teacher can export the report card with student photo and profile details visible
- Error states are explicit and non-destructive across archive, edit, upload, view, and export flows

## Implementation Notes

### Backend

- `subjects`, `classes`, `academicSessions`, and teacher `users` rows now carry archive metadata
- active setup selectors and access checks filter archived records out by default
- class, subject, session, and teacher archive mutations now preserve data instead of deleting it
- archiving a teacher now fails with a clear blocker message until active assignments are reassigned, rather than stripping those links automatically
- class archival now fails while students are still enrolled so student editing access is not orphaned
- subject archival now fails while the subject is still wired into active class/session workflows
- student updates now support broader profile editing, class reassignment validation, and photo metadata storage
- report-card data is composed from existing assessment records through `packages/convex/functions/academic/reportCards.ts`

### Admin App

- archive actions were added to the subjects, sessions, teachers, and classes setup screens
- the student management screen now supports selecting a student from the matrix and editing the student profile in place
- the student profile editor supports photo upload, replacement, and removal
- the admin assessment roster links directly to a printable student report-card page
- the admin report-card page now includes print-hidden controls for class-teacher comments, head-teacher comments, and the term-wide next-term start date

### Teacher App

- the teacher assessment roster now links directly to a printable student report-card page
- teacher report-card access is still constrained by assigned class access checks on the server

### Report Card Output

- report cards now render in a fuller print-sheet layout instead of the earlier simple summary table
- the backend now builds each report card from the student's full subject list for the selected session
- if a subject has no assessment record yet, the report card still includes it with zero-filled score cells and a pending status
- once assessment data is entered later, the same report-card sheet updates automatically without changing the student export flow
- the bottom section now reads from admin-managed per-student comments
- the `Next Term Begins` field now reads from the term's saved manual date rather than an inferred next-term lookup

## Verification

- `pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
- `convex dev --once --typecheck enable`

## Known Follow-Up

- Convex code generation still fails in the existing repo state because the shared package currently pulls React UI files into the Convex bundle path, causing unresolved `react` and `react/jsx-runtime` imports during `pnpm convex:codegen`
