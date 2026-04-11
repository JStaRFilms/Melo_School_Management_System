# T04 Historical Backfill Workflow

## Status

Completed on `2026-04-10`.

## What Changed

1. Added a new admin-only historical backfill route at `apps/admin/app/assessments/report-cards/backfill/page.tsx`.
2. Added a dedicated roster-style backfill workspace component at `apps/admin/app/assessments/report-cards/backfill/components/HistoricalBackfillWorkspace.tsx`.
3. The backfill workspace now lets admins:
   - select session, historical term, and class
   - load the class roster and subject list
   - review existing historical totals
   - enter or overwrite prior-term totals with optional notes
   - save only valid `0-100` totals through the audited historical snapshot mutation
4. Added direct admin backfill links from the report-card missing-data warning and blocked class-print state.
5. Synced the cumulative-results feature doc and FR-008 acceptance progress to reflect the landed backfill workflow.

## Files Updated

- `apps/admin/app/assessments/report-cards/backfill/page.tsx`
- `apps/admin/app/assessments/report-cards/backfill/components/HistoricalBackfillWorkspace.tsx`
- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
- `apps/admin/app/assessments/report-cards/page.tsx`
- `docs/features/CumulativeTermResultsAndBackfill.md`
- `docs/issues/FR-008.md`

## Verification Run

- `pnpm --filter @school/admin exec tsc --noEmit` ✅ after each TSX edit

## Notes

- The workflow is admin-only through both the route placement and the Convex authorization checks already in `historicalTermTotals.ts`.
- Historical totals still remain isolated from live assessment records.
- The next recommended orchestration step is `T06_verification_docs_release_gate.task.md`.
