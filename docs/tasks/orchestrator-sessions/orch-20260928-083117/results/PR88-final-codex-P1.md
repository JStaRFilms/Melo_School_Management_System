# PR #88 final Codex P1: report-card branch handoff

Addressed Codex comment 4138588317 on `ClassReleasePanel.tsx`. The release roster's review link now carries `schoolId`. The Admin report-card page waits for the selected workspace branch, rejects a link to a different branch before querying or rendering the report, and clears the old tuple when the branch changes, including across a loading state. Preview, batch roster, class print and certification pass the selected branch ID. The launcher carries that ID into its report-card links and batch query.

The four staff report-card endpoints now accept an optional `schoolId`. Each resolves active membership and its existing preview or publish capability for that school before using the tuple. Omission still follows the legacy membership path for Teacher callers. Existing tenant, class, session and term checks remain in force. Certification receives the same school ID as the preview rather than reading a potentially changing workspace selection separately.

Tests cover the non-default branch's missing-certification workflow through preview, batch, certification, readiness and release; another branch's tuple and a school without membership are rejected. Admin tests cover the roster review URL, selected-branch query and certification arguments, wrong-branch link suppression, and branch-switch reset across loading.

Checks passed: Convex and Admin typechecks; 15 focused Convex tests; 20 focused Admin tests; targeted ESLint and `git diff --check`. The informational theme audit found existing direct colours only: rose/red for semantic error or warning, emerald for success, indigo for product controls, amber for warning, and slate/hex for product or print neutrals. No branding colours changed.

The launcher still uses legacy Admin selectors for its session, term and class dropdowns; those selectors were outside this P1's four endpoint scope. A mismatched tuple cannot reach the preview or certification through the selected-branch endpoints. No FR-023 worktree, portal graded gate, commit, push, merge or deploy was touched.
