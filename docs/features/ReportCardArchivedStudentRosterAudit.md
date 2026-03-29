# Report Card Archived Student Roster Audit

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

## Notes
- The active roster leak came from `getStudentsForClassReportCardBatch`, which merged historical subject-selection student ids back into the class roster without a final archive check.
- Duplicate-read hardening in report-card comments and assessment records should pick the most recently updated record when duplicates exist.
