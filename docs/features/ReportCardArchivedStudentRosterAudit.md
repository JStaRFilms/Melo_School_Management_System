# Report Card Archived Student Roster Audit

**Status:** Implemented

## Goal
Keep archived students out of active report-card batch workflows while preserving direct historical report-card access for archived records when an admin intentionally opens them.

## Components

### Client
- `apps/admin/app/assessments/report-cards/page.tsx`

### Server
- `packages/convex/functions/academic/reportCards.ts`
- `packages/convex/functions/academic/studentEnrollment.ts`

## Data Flow
1. Admin opens the report-card page for a class, session, and term.
2. The client requests the batch roster through `getStudentsForReportCardBatch`.
3. Convex builds the roster from current class membership plus historical subject selections for that session.
4. The active batch roster now excludes archived student rows and archived linked user rows before returning the dropdown data.
5. Direct `getStudentReportCard` access remains available for historical review so archived students can still be opened intentionally through archival or audit flows.

## Regression Guardrails
- Archived students must not appear in active report-card dropdowns.
- Archived students must not appear in full-class report-card printing.
- Active students in the selected class must still appear even when historical subject selections exist.
- Historical report-card lookup for an explicitly selected archived student must still work.

## Class release exclusion review

The class release roster is separate from the active report-card batch roster. It still shows archived pupils so that archiving cannot silently remove a release blocker.

- `resultPublication.ts` allows a school admin to explicitly exclude an archived pupil still assigned to the selected current class, even without subjects or term marks. The student must have existed by the term end date, and any class evidence must agree with that class.
- The active session and term requirements remain. Tenant conflicts, disputed class history, duplicate reports and duplicate exclusions still block exclusion. Active pupils without enrollment proof remain blocked.
- `ClassReleasePanel.tsx` shows the available exclusion action to admins without telling them to contact an administrator. The existing dialog requires a reason and warns that the pupil will not receive this release.
- `excludeStudent` recomputes readiness, stores the reason and approving admin in `classResultExclusions`, and records `result_release.exclude`. `releaseClassResults` recomputes the roster before freezing it. No schema change is needed.
- Archiving alone neither excludes a pupil nor certifies a report. An exclusion does not create subjects, marks or a report. Released rosters and issued copies remain frozen.

## Notes
- The active roster leak came from `getStudentsForClassReportCardBatch`, which merged historical subject-selection student ids back into the class roster without a final archive check.
- Duplicate-read hardening in report-card comments and assessment records should pick the most recently updated record when duplicates exist.
