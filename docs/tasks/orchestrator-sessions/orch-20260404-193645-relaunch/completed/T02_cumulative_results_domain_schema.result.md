# T02 Cumulative Results Domain and Schema

## Status

Completed on `2026-04-09`.

## What Changed

1. Added cumulative-results domain helpers in `@school/shared` for:
   - annual-average calculation
   - cumulative-mode activation rules
   - missing-prior-term detection
   - grade/remark derivation from the annual average
2. Added schema support in `packages/convex/schema.ts` for:
   - `historicalTermTotals`
   - `academicTerms.reportCardCalculationMode`
   - `assessmentRecords.by_student_and_session`
3. Added admin-only historical backfill backend functions in:
   - `packages/convex/functions/academic/historicalTermTotals.ts`
4. Extended report-card term settings backend so a term can opt into:
   - `standalone`
   - `cumulative_annual`
5. Updated `packages/convex/functions/academic/reportCards.ts` so third-term report-card generation can:
   - resolve prior totals from real assessment records first
   - fall back to `historicalTermTotals` snapshots
   - compute annual averages for cumulative mode
   - derive cumulative grade/remark from the annual average
   - return cumulative breakdown metadata for later UI work
6. Added shared-domain tests for the new cumulative helpers.
7. Updated cumulative-results feature documentation to reflect the landed backend foundation.

## Files Updated

- `packages/shared/src/cumulative-results.ts`
- `packages/shared/src/__tests__/cumulative-results.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/components/ReportCardSheet.tsx`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/historicalTermTotals.ts`
- `packages/convex/functions/academic/reportCardTermSettings.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
- `docs/features/CumulativeTermResultsAndBackfill.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/shared exec tsc --noEmit` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin exec tsc --noEmit` ✅
- `pnpm --filter @school/shared test` ✅
- `pnpm test` ✅

## Notes

- The backend now supports cumulative third-term calculation and historical carry-forward storage.
- The cumulative UI and backfill workflow are still pending; those belong to the next tasks.
- Because the next queued task (`T03`) is a UI task, the orchestrator should stop and hand control back to the user before implementation continues.
