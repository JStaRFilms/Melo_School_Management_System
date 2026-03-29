# Grading Bands

## Goal
Allow school admins to define the score thresholds that map totals to result labels. Each grading band should be editable so the admin can choose the grade letter, set the score range, and provide the remark used during result derivation.

## Components

### Client
- `apps/admin/app/assessments/setup/grading-bands/page.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandTable.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandRow.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandValidationBanner.tsx`

### Server
- `packages/convex/functions/academic/gradingBands.ts`
- `packages/convex/schema.ts`
- `packages/shared/src/exam-recording/validation.ts`
- `packages/shared/src/exam-recording/calculations.ts`

## Data Flow
1. Admin opens the grading-bands screen.
2. The client loads the active bands for the current school.
3. The admin edits band rows, including the grade letter, min/max scores, and remark.
4. Client-side validation checks for gaps, overlap, coverage, and invalid ranges.
5. On save, the mutation validates again and replaces the active band set for the school.
6. Result derivation uses the saved bands to map totals to grade letter and remark.

## Database Schema
- Table: `gradingBands`
- Fields:
  - `schoolId`
  - `minScore`
  - `maxScore`
  - `gradeLetter`
  - `remark`
  - `isActive`
  - `createdAt`
  - `updatedAt`
  - `updatedBy`
- Active bands are queried with `by_school_active`.

## Current Issue
The grade badge in the UI is currently display-only, so admins can edit the score range and remark but cannot choose which letter belongs to each band. The fix should add a grade-letter selector/input per row and keep validation aligned with the saved band order.

## Update
- The grade column should now behave as an editable field instead of a read-only badge.
- Grade labels should be required before saving so the school does not end up with anonymous bands.
- Decimal totals from scaled exams or aggregated report-card subjects grade against the containing whole-number band, so a total like `69.5` still resolves inside the `60-69` band unless the school changes the thresholds.
