# Task B-01 / M0: Quality Baseline and Environment Gate

## Objective
Clear known blockers without masking root cause, and establish safe rehearsal readiness.

## Scope
- Fix teacher conditional-hook lint errors in `apps/teacher`.
- Investigate `packages/convex/foundationContracts.test.ts` parallel-only timeout by profiling fixture/module/setup contention. Do not increase the timeout without root-cause evidence.
- Execute/prepare the safe development refresh preparation and rehearsal process from D-05 (`docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md`).

## Definition of Done
- No conditional-hook lint blocker remains in `apps/teacher`.
- Root cause for `foundationContracts.test.ts` timeout identified; setup minimized, concurrency contention isolated, and test execution verified both in isolation and in parallel runner.
- No production mutation; no exports/secrets/PII committed.
- Clean git diff with focused test/lint verification.

## Expected Artifacts
- Source code fixes for teacher lint violations.
- Root cause report and fix for `foundationContracts.test.ts`.
- M0 baseline verification report.

## Dependencies
- D-01 through D-05 complete and approved (satisfied).
- PR #21 merged (satisfied).
