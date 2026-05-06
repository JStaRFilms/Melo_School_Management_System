# Builder Handoff Report

## Built Features

- FR-008 batch report-card print fix: `Print Class` now renders the batch stack as normal paginated print flow, with each student constrained to one A4 page.
- Preserved the single-student print path by limiting the CSS override to `.rc-batch-print-v2-*` selectors in the batch print component.

## Root Cause

`ReportCardSheet` injects single-report print CSS that positions `.rc-print-root` as `position: fixed`. In full-class print, every report card reused that same sheet, so multiple student sheets were effectively removed from normal print pagination and overlaid at the first printable position. Chrome therefore saw one printable page (`Total: 1 page`) even when `getClassReportCards` returned multiple students.

## Files Changed

- `packages/shared/src/components/ReportCardBatchPrintStackV2.tsx`
  - Strengthened batch-only print CSS.
  - Restores batch pages to static/relative flow.
  - Forces each `.rc-batch-print-v2-page` to exactly `210mm x 297mm` with a page break after each student.
  - Overrides the single-sheet fixed positioning only inside the batch stack.
- `docs/issues/FR-008.md`
  - Marked print layout acceptance criterion complete for full-class one-page-per-student batch printing.

## Verification Status

- `pnpm --filter @school/shared typecheck` — passed.
- `pnpm typecheck` — started and package typechecks/builds progressed, but root command timed out at 120s during the full monorepo run.
- `pnpm --filter @school/admin lint` — passed with existing warnings only.
- `pnpm --filter @school/teacher lint` — passed with existing warnings only.
- `pnpm --filter @school/admin build` — passed.
- `pnpm --filter @school/teacher build` — passed.

## How to Run

1. Open admin or teacher report cards for a selected class/student/session/term.
2. Click `Print Class`.
3. Confirm the browser print dialog page count equals the number of class report cards, with one A4 page per student.

## Notes / Remaining Work

- No Convex query change was required: `getClassReportCards` already maps over the full roster returned by `getStudentsForClassReportCardBatch`.
- Manual browser print dialog verification is still recommended against real class data to confirm the page total equals `classReportCards.length`.
