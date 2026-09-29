# FR-023 review and rollout gates

This branch is based on `origin/master` at `23c4880`. The new report mode is per class/session; teachers write one comment for each student's applicable subject in each term. Existing graded behavior stays unchanged in this branch. Foundation pupils are not enrolled by selecting a report mode.

## Checks performed before PR

- Convex full suite: 65 files, 501 tests passed after PR review corrections, including numeric-write guards and independent per-class drafts for midterm transfers.
- Admin focused narrative/entry tests: 4 files, 9 passed; teacher entry tests: 5 passed. Portal narrative tests: 2 files, 5 passed. Earlier graded deep-link tests also passed.
- Convex, shared, admin, teacher and portal typechecks passed; `git diff --cached --check` clean.
- Chromium print smoke exercised the fixed-height workspace shell: long portal and staff review reports each span three A4 pages, and a two-student batch spans four. Navigation is hidden and last-page report text remains visible. Theme audit was informational; direct colors classified in `portal-integration.md`.
- Independent reviewer passes R1/R2/R3 found and closed tenant purge, historical roster, subject aggregation, class term index, graded transfer history, snapshot size and print issues. R3 found no remaining confirmed FR-023 code blocker. Full authenticated browser flow and production deployment were not run.

## Release gates still open

1. **Large-school staged index.** `issuedReportCards` gets a staged `by_classId_and_sessionId` index. It is not queried in this PR. Until backfill is complete and a later deployment promotes it to an unstaged index and changes the guard to use it, schools with more than 1,000 lifetime issued graded cards cannot list or switch reporting modes. The current school-index scan fails closed. Do not roll this feature out to those schools on this branch alone. Verify backfill before the second deployment; never query a staged index.
2. **Other agent's graded-parent policy.** Their worktree owns the existing graded portal publication change. Reconcile their `packages/convex/functions/portal.ts` changes line by line before merging if their branch lands first or in the integration PR that follows; test both graded publication and narrative issued-only behavior. FR-023 must never expose draft comments regardless of graded policy.
3. **Print and browser checks.** Admin class print is issued-only and rejects classes above 40 students or aggregate response above 512 KiB; those schools can print per student. Authenticate in a real school/parent browser session, verify child/term switching and multi-page prints on supported printers before release. Tests and standalone Chromium PDF smoke are not that check.

PR review may proceed with these constraints explicitly stated. Green CI does not mean unrestricted production rollout.
