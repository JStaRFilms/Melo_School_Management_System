# PR #88 feedback ledger

Reviewed PR head `19b03b3ec96d6b77d7e8e427317c0683ff80aab1`. Initial Vercel previews triggered; seven application checks must be evaluated, not the `Vercel Preview Comments` check. No merge/deploy.

- Codex inline `4126960509`, P1, branch context missing in `resultPublication.ts` and Admin release page. Confirmed blocker: selected non-default branch uses default school, showing endless load and wrong branch API context. Fix by passing selected school ID to every read/write function and server-verifying membership/permissions; add multi-branch test. Reply after commit.
- Codex inline `4126960519`, P2, schoolEvents oldest-256 truncation in `portal.ts`. Confirmed regression caused by changing `.collect()` to `by_school.take(256)`. Use indexed `by_school_and_start` with date range to show upcoming events without losing recent entries; keep portal result gate unchanged. Reply after commit.
- Kilo inline `4127099953`, same head, confirmed blocker: URL changes within mounted Admin release route leave selected tuple stale and could release the wrong class. Synchronize URL and component selection and test back/forward/deep link.
- Kilo inline `4127099958`, same head, confirmed minor UX defect: changing session retains prior class. Clear class and term on session change; class is school-scoped, not session-owned, so this is selection confusion rather than proven cross-tenant access.
- Kilo inline `4127099967`, same head, confirmed UX defect: stale roster in open modal silently disables submit with no in-dialog explanation. Show visible stale message and test.
- Kilo inline `4127099973`, same head, confirmed UX defect: exposed raw internal staff IDs instead of readable approver/publisher identity. Prefer safely resolved staff display name; preserve immutable ID in audit, never present bare ID in UI.
- CodeRabbit bot summary says automatic review skipped for low-star repo, not a finding; no human root review thread. @codex review requested and reviewed exact head. Kilo completed at same head with four comments. Initial seven Vercel application previews passed.

User instructed: every subsequent intermediate push uses `[skip vercel]`; after code/review settle run one final unmarked empty commit to trigger final preview. Hold any intermediate push until initial preview settles if feasible. Reply to every substantive root thread before resolution.
