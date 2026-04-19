# Cumulative Term Results and Historical Backfill

## Goal

Extend the current per-term assessment and report-card system so schools can produce third-term cumulative results using:

- first-term total
- second-term total
- current third-term total

The final cumulative subject grade should be:

`(firstTermTotal + secondTermTotal + thirdTermTotal) / 3`

This feature must also support schools that started using the system in second term by allowing clean backfill of missing prior-term totals without forcing fake CA or exam breakdowns.

## Why This Exists

- The current implementation is term-isolated.
- `assessmentRecords` store one term at a time and the current report-card output only reflects the selected term.
- Real schools often expect third-term result sheets to show the cumulative annual picture, not only the current term.
- Some schools start mid-session, so prior-term data may exist on paper or in another system and still needs to influence the annual report.

## Current Constraint

The current exam-recording slice explicitly excludes cumulative aggregates and CGPA. See:

- `docs/features/ExamRecording.md`
- `docs/issues/FR-006.md`

This blueprint closes that gap for cumulative third-term reporting without rewriting the existing term-entry workflow.

## Scope

### In Scope

- Third-term cumulative subject totals for report cards
- Storage for prior-term backfill when detailed term components are not available
- Admin workflow to enter or import prior-term totals by student and subject
- Clear report-card UX showing:
  - current-term score
  - prior-term totals
  - cumulative annual average
  - missing-prior-data state
- Server-side cumulative calculation used by printable report cards and class batch printing
- School-safe handling for schools that started in second term

### Out Of Scope

- Full session-wide ranking or position logic
- CGPA for multi-session transcripts
- Portal-facing cumulative result UX
- Automatic import from arbitrary external file formats
- Replacing the existing term score-entry grid with a different model

## Product Rules

### Primary Rule

For a third-term cumulative report:

- `firstTermTotal` = first-term subject total
- `secondTermTotal` = second-term subject total
- `thirdTermTotal` = current third-term subject total
- `annualAverage = round((firstTermTotal + secondTermTotal + thirdTermTotal) / 3, 2)`

The grade and remark shown for the annual cumulative result should derive from `annualAverage`, not only the current third-term total.

### Mid-Session Adoption Rule

If a school starts in second term and does not have first-term records inside the system:

- an admin can add a prior-term total-only entry for first term
- that prior entry is treated as a historical snapshot, not a full `assessmentRecord`
- the system must never invent fake CA or exam components just to satisfy schema

### Missing Data Rule

If cumulative mode is expected for third term but one or more prior-term totals are missing:

- the UI must show the subject as incomplete for cumulative reporting
- admins must see a clear backfill call to action
- teachers should not be asked to fabricate prior-term values in the normal score-entry sheet

## Recommended Data Model

### Keep `assessmentRecords` As-Is

Do not overload `assessmentRecords` with fake historical CA or exam fields for imported prior totals.

### Add `historicalTermTotals`

Store prior-term carry-forward totals as a separate table:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `sessionId` | id | Academic session |
| `termId` | id | Historical term being represented |
| `classId` | id | Student class context when entered |
| `subjectId` | id | Subject |
| `studentId` | id | Student |
| `total` | number | Historical term total out of 100 |
| `source` | `"manual_backfill" \| "migration_snapshot"` | Entry source |
| `notes` | string? | Optional audit note |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | Admin user |

### Add Optional Report Card Calculation Mode

Add school- or term-level configuration so the report-card layer knows when to produce cumulative third-term output:

- third term may be marked as `standalone` or `cumulative_annual`
- this should live in report-card settings, not score-entry settings

## Components

### Client

- `apps/admin/app/assessments/report-cards/page.tsx`
  - show cumulative mode for the selected term
  - surface missing prior-term data warnings
- new admin backfill route under assessments or report cards
  - grid for student-subject prior totals
  - batch entry focused on first-term and second-term totals
- `apps/teacher/app/assessments/report-card-workbench/page.tsx`
  - show read-only annual cumulative summary when third term is selected
  - do not make teachers responsible for backfill
- shared printable report-card components
  - support rendering current-term and annual cumulative values distinctly

### Server

- `packages/convex/functions/academic/reportCards.ts`
  - resolve prior-term totals
  - compute annual cumulative average for third-term report cards
- new `packages/convex/functions/academic/historicalTermTotals.ts`
  - admin-only CRUD for prior-term totals
  - validation and batch save helpers
- `packages/convex/functions/academic/reportCardTermSettings.ts`
  - store cumulative-mode configuration for term output
- `packages/shared/src`
  - reusable cumulative-calculation helpers and validators

## Data Flow

### Normal Current-Term Entry

1. Teacher or admin enters third-term CA and exam scores using the existing sheet.
2. The system stores the normal third-term `assessmentRecords`.
3. Report-card generation loads current-term records as it does today.

### Historical Backfill

1. Admin opens a prior-term backfill workspace.
2. Admin chooses session, historical term, class, and subject.
3. System loads current students and any existing historical total snapshots.
4. Admin enters total-only values for missing prior terms.
5. System validates totals as `0-100` and stores them in `historicalTermTotals`.

### Third-Term Cumulative Report

1. Report-card generation detects that the selected term uses cumulative annual mode.
2. The server loads:
   - current third-term term totals from `assessmentRecords`
   - prior first-term and second-term totals from either:
     - normal `assessmentRecords` if present, or
     - `historicalTermTotals` if backfilled
3. The server computes `annualAverage`.
4. The server derives grade and remark from `annualAverage`.
5. The report-card UI clearly shows the breakdown and the final annual value.

## UX Rules

### Clarity

- Current term and annual cumulative values must be visually distinct.
- A teacher should immediately know whether they are looking at:
  - current-term total
  - historical prior total
  - annual cumulative average

### Backfill UX

- Prior-term backfill should use a simple roster-style grid, not the full CA/exam grid.
- The workflow should be admin-only.
- Missing prior terms should be obvious before printing a class report stack.

### Safety

- Backfill must be auditable.
- Historical totals should not silently overwrite live term records.
- Any manual backfill should preserve who entered it and when.

## Validation Rules

- Historical total must be between `0` and `100`
- Only admins can create or edit historical term totals
- Backfill records must remain school-scoped
- Only one historical total per:
  - `schoolId`
  - `sessionId`
  - `termId`
  - `classId`
  - `subjectId`
  - `studentId`
- If a normal `assessmentRecord` already exists for that same student/subject/term, the report-card layer should prefer the real term record over the historical snapshot

## Edge Cases

- Student changed class between terms
- Subject offering changed between terms
- Student was added in second or third term
- School started using the app after first term
- Third-term cumulative enabled before prior totals are backfilled

## Recommended Phasing

### Phase 1

- Add historical total storage
- Add admin backfill UX
- Add cumulative report-card computation for third term

### Phase 2

- Add missing-data warnings to class batch printing and report-card review
- Add import helpers for structured spreadsheet backfill if needed

### Phase 3

- Extend to ranking, annual positions, and later transcript/CGPA work if still required

## Files Likely To Change

- `packages/convex/schema.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `packages/convex/functions/academic/reportCardTermSettings.ts`
- `packages/convex/functions/academic/assessmentRecords.ts`
- `packages/shared/src/components/ReportCardSheet.tsx`
- `packages/shared/src/components/ReportCardPrintStack.tsx`
- `apps/admin/app/assessments/report-cards/page.tsx`
- `apps/teacher/app/assessments/report-card-workbench/page.tsx`

## Implementation Status

### Foundation and UI Landed on `2026-04-10`

The backend/domain slice for cumulative results is now in place:

- `packages/convex/schema.ts`
  - adds `historicalTermTotals`
  - adds `academicTerms.reportCardCalculationMode`
  - adds `assessmentRecords.by_student_and_session` for session-wide report-card lookups
- `packages/convex/functions/academic/historicalTermTotals.ts`
  - admin-only read/write support for historical prior-term total snapshots
- `packages/convex/functions/academic/reportCardTermSettings.ts`
  - exposes and saves `resultCalculationMode` for term-level report-card behavior
- `packages/convex/functions/academic/reportCards.ts`
  - resolves prior-term totals from real assessment records first, then historical snapshots
  - computes third-term annual averages when cumulative annual mode is enabled
  - returns cumulative breakdown metadata for later UI work
- `packages/shared/src/cumulative-results.ts`
  - reusable cumulative-average and missing-data helpers with tests

The presentation layers have also been augmented to present the metrics clearly:

- admin-facing warnings for missing prior-term results prior to backfill, with printing blocked until missing totals are resolved
- teacher cumulative-report readability enhancements with conditionally rendered columns, explicit annual-average labeling, and incomplete-state visibility
- printable report-card layout updates to visibly present the cumulative breakdown, mark incomplete subjects, and suppress ambiguous final grade/remark output while historical data is missing

### Backfill Workspace Landed on `2026-04-10`

- admin-only historical backfill route at `apps/admin/app/assessments/report-cards/backfill/page.tsx`
- roster-style student/subject grid for prior-term total entry with notes
- audit-safe overwrite flow using the existing historical snapshot mutation
- direct admin CTA from report-card missing-data warnings into the backfill workspace
- term-level result layout selection now lives with session/term setup, where admins can create or update a term as `standalone` or `cumulative_annual`

## Definition Of Done

- Third-term cumulative report cards work from actual prior-term totals
- Schools that started mid-session can backfill historical totals cleanly
- No fake prior CA/exam breakdowns are required
- Missing prior-term data is obvious before printing or review
- Admin and teacher UX remain simple and role-appropriate
