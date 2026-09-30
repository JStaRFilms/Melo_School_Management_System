# Task 02: editable admin policy, score entry, print warnings

## Scope
Use `master-plan.md` and `backend-handoff.md`. Work on `apps/admin`, `apps/teacher`, relevant shared UI only, and UI tests. Avoid editing Convex backend/schema until review handoff. Read AGENTS.md and tenant theme policy. Admin setup page `/assessments/setup/exam-recording` needs session-specific five-field policy and three editable preset starters. Clearly separate school-wide legacy mode and term editing window from new session policy. Do not show the static 20/20/20/40 as current policy for custom sessions.

## Impact flow
Validate sum 100 before scan. Start scan before preview, display partial scanning status, final affected-score and invalid counts, up to 10 actionable score errors, failure resume/cancel. Explicit confirmation only for fully scanned valid preview, with expected version and policy. Apply starts regrade, not completion. Poll job until complete. Show locked/failure/retry status without claiming success early. Preserve draft on errors and guard departures. Avoid implying old sessions are automatically updated.

## Score entry
Teacher/admin grids and validation, max labels, exam scaled score and totals should read effective session policy (ca1Max, ca2Max, ca3Max, examRawMax, examContributionMax) from session score sheet rather than hard-coded 20/40/60. Legacy settings still work. Loading/guard errors during regrade should be clear.

## Reports
Expose brief screen-only warning before single and batch printing when an issued report predates a completed session policy regrade. Include both admin/teacher print routes and auto-print triggers; immutable issued payload unchanged. Show recertification guidance (if backend cannot recertify, do not promise a working recertify button). No new alert dashboard or site sync. Reuse UI components and accessible dialog conventions. Audit theme-colors on touched school-facing files.

## Done when
UI can configure 20/20/10 + /80->50, see a complete impact review, confirm and follow progress; students' /10 and /80 entry validate, preview matches backend; alerts appear before affected print flows; unaffected reports do not warn; responsive tests pass. Report backend API gaps if any. Run focused tests, app typecheck/lint and theme audit; no commit/push.
