# PR88 final extras branch correction

Resolved Codex P1 inline 4138936883. Both Admin report-card links to extras now carry the selected `schoolId`. The extras page takes its branch from ready `workspaceAccess`, passes that ID to the existing selectors, roster, entry query, and save mutation, and keeps it in selector navigation and the report-card return link. A mismatched URL displays a branch warning without fetching data. Branch switches remount the editor, clear the old tuple, and skip reads until the URL settles.

`getStudentReportCardExtrasEntry` and `saveStudentReportCardExtrasEntry` accept optional `schoolId` and retain their existing capability, role, and tenant checks. Callers without the new argument still resolve their default branch. The Teacher extras editor was not changed.

Verification passed: Admin and Convex typechecks; full Admin suite, 287 tests; full Convex suite, 658 tests; focused Admin rerun, 9 tests; focused Convex rerun, 2 tests; `git diff --check`. The informational theme audit ran. In the touched files, slate and white are product neutrals; indigo is an existing product-control colour; amber and rose in the report-card page are semantic warning/error colours. No tenant branding or print colours were changed. Existing unrelated test warnings appeared in the full suites.

No FR-023 edits, commit, push, merge, or deploy. The orchestrator owns skip-Vercel commits.
