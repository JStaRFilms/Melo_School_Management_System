# Class-Level Batch Report Card Printing

## Goal

Add a class-level batch print workflow for report cards so admins and teachers can move through every student in a selected class without reopening one student at a time. In the same pass, expose a clean admin-side place to upload the school logo so every exported report card can render branded output consistently.

## Why This Feature Exists

The current report-card flow is single-student only:

- open one student
- review one report card
- print one report card

That works for spot-checking, but it is slower than the school's prior Excel workflow where staff could move through a whole class and print continuously. The current codebase also has no persisted school-logo upload flow, even though the shared report-card sheet already supports rendering a logo when one is available.

## Scope

### In Scope

- Class-level batch report-card screen on admin
- Class-level batch report-card screen on teacher
- Student-to-student navigation within the selected class/session/term context
- Quick export/print flow for the current student from the batch screen
- Optional "print current class" mode using the same shared report-card sheet layout
- Admin-side school-logo upload and replacement
- Convex-backed storage of school logo metadata
- School logo display on admin and teacher report-card exports

### Out Of Scope

- PDF generation service
- Parent portal bulk report-card delivery
- Multi-class bulk print in one click
- Additional school-branding fields beyond the logo in this pass
- Reworking the core report-card grading layout beyond what already exists

## Regression Guardrails

This pass must not break:

- Existing single-student report-card URLs
- Admin-only comment editing on report cards
- Teacher read-only access rules for report cards
- Existing student photo rendering
- Existing print/export behavior for one student

## Components

### Client: Admin App

- `apps/admin/app/assessments/report-cards/page.tsx`
  - keep support for the existing single-student URL shape
  - expand to accept class-aware batch params
- new batch-print support components under:
  - `apps/admin/app/assessments/report-cards/components/`
  - class context header
  - student list / next-previous navigator
  - school-logo upload card
  - optional print-all trigger panel

### Client: Teacher App

- `apps/teacher/app/assessments/report-cards/page.tsx`
  - support class-aware batch navigation
  - keep teacher flow view/export only

### Shared UI

- keep `packages/shared/src/components/ReportCardSheet.tsx` as the printable core
- add small helpers for:
  - query-param aware student navigation
  - school-logo preview/fallback handling
  - batch-print-safe rendering if we support print-all in one pass
- the shared sheet now fits against the real A4 printable area in both screen and print, so admin and teacher exports use the same scale and the outer side chrome stays out of the way
- the shared sheet uses print-time zoom instead of only visual transforms, so Chromium print preview actually paginates the scaled layout as one sheet when it fits

### Server: Convex

- `packages/convex/schema.ts`
  - add school logo storage metadata
- `packages/convex/functions/academic/reportCards.ts`
  - add class roster query for report-card batch navigation
  - include school logo URL in report-card payload
- likely add a school-branding module or extend an existing admin-facing module for:
  - generating upload URL
  - saving/replacing school logo metadata

## Client / Server Split

### Batch Printing

#### Client

- User chooses class, session, and term from an existing assessment context
- Client loads all report-card-eligible students in the class
- Client opens the report-card screen with:
  - selected student
  - class roster context
  - next/previous navigation
- User can:
  - move to next student
  - move to previous student
  - jump directly to another student in the class
  - print the current student
  - optionally trigger print-all if the page has fully loaded all students

#### Server

- Validate admin or teacher access to the class
- Return the ordered student roster for the selected class/session
- Reuse existing per-student report-card query for the active student
- Include school branding metadata in every report-card payload

### School Logo Upload

#### Client

- Admin opens the report-card page
- Admin sees a print-hidden school-branding card
- Admin can upload, replace, or remove the school logo
- Preview updates before or after save

#### Server

- Generate upload URL for image file
- Validate admin access and school ownership
- Save school logo storage metadata on the school record
- Return storage URL for report-card rendering

## Data Flow

### 1. Open Batch Report-Card Screen

1. User selects class, session, and term from an assessment roster context.
2. Client routes to the report-card page with class-aware params.
3. Client requests the student roster for that class/session.
4. Client requests the current student's report card.
5. Page renders:
   - class context
   - active student report card
   - next/previous controls
   - direct student picker

### 2. Move Between Students

1. User clicks `Next`, `Previous`, or another student name.
2. Client updates the active student param in the URL.
3. Report-card query refreshes for the selected student.
4. The same print/export layout updates without leaving the class context.

### 3. Upload School Logo

1. Admin selects an image file in the school-logo upload area.
2. Client requests a Convex upload URL.
3. File uploads to storage.
4. Client saves the storage metadata against the school record.
5. Report-card queries resolve the logo URL and the shared sheet displays it.

### 4. Print Current Student Or Class

1. User clicks `Export / Print`.
2. Client prints the current student sheet.
3. If print-all is enabled in this pass, client prepares the class stack and opens a print-friendly render using the same sheet component for each student.

## Database Schema

### Extend `schools`

Add optional school-logo metadata:

- `logoStorageId?: id("_storage")`
- `logoFileName?: string`
- `logoContentType?: string`
- `logoUpdatedAt?: number`

### Query-Only Derived Fields

Batch-print flows should derive, not store:

- ordered class roster for the selected session
- active student index within the class
- resolved school logo URL

## Query / Mutation Additions

### Report Cards

- `getStudentsForReportCardBatch`
  - inputs:
    - `classId`
    - `sessionId`
    - `termId`
  - returns:
    - ordered student roster
    - minimal summary for navigation

### School Branding

- `generateSchoolLogoUploadUrl`
- `saveSchoolLogo`
- `removeSchoolLogo`

## Error Handling

### Batch Navigation Errors

- class not found
- session not found
- term not found
- student not found in selected class context
- unauthorized teacher access to the class
- no students found for the selected class/session

### School Logo Errors

- upload URL generation failed
- invalid logo upload metadata
- non-image file upload attempt
- logo upload completed but save failed
- cross-school access denied

### Print Errors

- report card not fully loaded
- class roster unavailable
- print-all requested before student data finished loading

## File Shape / Modularity Plan

To stay aligned with the 200-line modularity rule, split the work into:

- batch roster hook/helper
- batch navigation component
- school-logo uploader component
- optional print-all container component
- thin route pages that compose those pieces

## Acceptance Targets

- Admin can open a report-card page for a class and move student-to-student quickly
- Teacher can do the same within allowed class access
- Existing direct single-student report-card links still work
- Admin can upload or replace the school logo from the report-card area
- Uploaded school logo appears on exported report cards
- Error states are explicit for batch loading, printing, and logo upload

## Implementation Notes

### Backend

- `schools` now stores optional logo metadata in Convex
- `getStudentReportCard` now returns:
  - `classId`
  - resolved `schoolLogoUrl`
- `getStudentsForReportCardBatch` now returns the ordered student roster for a class/session/term with admin and teacher authorization checks
- school-logo upload is handled by a dedicated `schoolBranding` Convex module with:
  - `generateSchoolLogoUploadUrl`
  - `saveSchoolLogo`
  - `removeSchoolLogo`

### Admin App

- the admin report-card page now supports class-aware batch navigation
- the page includes a print-hidden batch navigator with:
  - student jump dropdown
  - previous button
  - next button
- the admin controls panel now includes a school-logo upload card for report-card branding
- admin score-entry links now pass `classId` into the report-card route so the batch context is ready immediately
- admin and teacher student/report-card links now use the shared route builders from `packages/shared` so export and print entry points stay aligned

### Teacher App

- the teacher report-card page now supports the same class-aware batch navigation
- teacher score-entry links now pass `classId` into the report-card route
- teacher access remains read/export only

### Shared UI

- `ReportCardBatchNavigator` now provides the shared class-run navigation UI
- `ReportCardSheetData` now includes `classId` so pages can preserve batch context while reusing the same printable sheet

## Verification

- `convex dev --once --typecheck enable`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`

## Follow-Up

- This pass delivers fast student-to-student class navigation and branding upload
- true one-click print-all for the whole class is still deferred; current printing remains per student using the faster batch navigator
