# T03 Cumulative Results UI and Printing

## Status

Completed on `2026-04-10`.

## What Changed

1. Updated the admin report-card review flow to surface clearer missing-prior-term warnings for cumulative annual mode.
2. Updated the teacher workbench results summary to:
   - label cumulative columns more clearly
   - distinguish annual cumulative rows from standalone rows
   - keep incomplete cumulative rows visibly marked
3. Updated the shared printable report-card sheet to:
   - render cumulative columns for 1st, 2nd, 3rd term, and annual average
   - mark standalone rows distinctly in cumulative mode
   - suppress ambiguous final grade/remark output when cumulative data is incomplete
   - block single-card printing until missing prior-term totals are resolved
4. Updated both admin and teacher full-class print flows to block class printing when any cumulative report card in the batch is still incomplete.
5. Fixed the JSX table-body regression in `ReportCardSheet.tsx` uncovered during the review pass.
6. Synced the cumulative-results feature document and session artifacts to reflect the completed UI/printing slice and the next queued task.

## Files Updated

- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
- `apps/admin/app/assessments/report-cards/page.tsx`
- `apps/teacher/app/assessments/report-card-workbench/components/ResultsSummary.tsx`
- `apps/teacher/app/assessments/report-cards/page.tsx`
- `packages/shared/src/components/ReportCardSheet.tsx`
- `docs/features/CumulativeTermResultsAndBackfill.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`

## Verification Run

- `pnpm --filter @school/shared exec tsc --noEmit` ✅
- `pnpm --filter @school/admin exec tsc --noEmit` ✅
- `pnpm --filter @school/teacher exec tsc --noEmit` ✅
- `pnpm --filter @school/shared lint` ✅
- `pnpm --filter @school/admin lint` ✅
- `pnpm --filter @school/teacher lint` ⚠️ one pre-existing warning remains in `app/assessments/report-card-extras/components/ExtrasWorkspace.tsx` and is outside T03 scope

## Notes

- The T03 review pass accepted the cumulative UI/printing slice after fixing compile safety and ambiguous-printing gaps.
- The next recommended task in this orchestration session is `T04_historical_backfill_workflow.task.md`.
- After `T04`, the session should move to `T06_verification_docs_release_gate.task.md` for wider release-hardening.
