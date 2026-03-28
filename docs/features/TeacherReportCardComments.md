# Teacher Report Card Comments

## Goal

Give teachers a dedicated report-card workbench where they can open a student, review the student's results, adjust that student's subject setup, and write the class-teacher comment in one long scroll. Admins keep the head-teacher and next-term controls in the admin workspace.

This is a UX expansion and a permission expansion, not a new report-card shape. The existing report-card comment storage and printable output stay the same.

## Components

### Client

- `apps/teacher/app/assessments/report-card-workbench/page.tsx`
  - dedicated landing page for teacher assessment follow-up
  - class and student selectors at the top
  - one long scroll with result, subject, and comment sections
- `apps/teacher/app/assessments/report-card-extras/page.tsx`
  - legacy route that now redirects into the workbench so teachers do not land on the old extras-bundle page
- `apps/teacher/app/assessments/layout.tsx`
  - shared teacher assessments shell with the top navbar and sign-out actions
  - keeps the workbench in the same chrome as exam entry and report extras
- new teacher-side workbench components under `apps/teacher/app/assessments/report-card-workbench/components/`
  - student selector and next-student navigation
  - report-card results section
  - student subject-change section
  - class-teacher comment textarea with save / success / error feedback
  - read-only display of the head-teacher comment if present
- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
  - keep the current admin controls
  - continue to support both class-teacher and head-teacher comments
  - continue to support next-term date editing

### Server

- `packages/convex/functions/academic/reportCards.ts`
  - allow teacher-role users to save the class-teacher comment for classes they are assigned to
  - preserve any existing head-teacher comment when a teacher updates the student record
  - keep admin-only access for head-teacher and term-date fields
- `packages/convex/functions/academic/auth.ts`
  - reuse the existing class-assignment checks for teacher access

## Data Flow

1. Teacher opens a student's report card from the teacher workspace.
2. The workbench loads the student's report card, current subjects, and current comment fields.
3. The teacher edits the class-teacher comment or adjusts subject selections, then saves each section.
4. The server verifies the teacher belongs to the school and is assigned to the selected class.
5. The server upserts the existing `reportCardComments` row for that student, session, and term.
6. If a head-teacher comment already exists, it remains unchanged unless an admin updates it.
7. The printable report-card sheet refreshes with the saved comment.

## Database Schema

No new table is required.

The existing `reportCardComments` table continues to store:

- `schoolId`
- `studentId`
- `sessionId`
- `termId`
- `classTeacherComment`
- `headTeacherComment`
- `createdAt`
- `updatedAt`
- `updatedBy`

## Approval Gate

This stub is the blueprint for the change.

Implementation starts after approval so we can update the teacher UI, relax the backend role check safely, and keep the admin flow unchanged.
