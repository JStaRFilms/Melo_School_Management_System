# B1 result

Status: backend complete, UI acceptance pending.

## Local commits
- f1eb98a: shared name rules and draft fields.
- a70fe2f: identity/enrollment/family/address/login/provision contracts and promoted-session subject selections.

## Coder-reported checks
125 Convex tests, 22 shared tests, Convex/shared TypeScript and diff checks passed.
Full API handoff and limitations: B1.md completion section.

## Parent handoff verification
16 tests across identityOnboarding.integration and studentNameCompat passed (7.34s).
Convex and shared noEmit typechecks passed.
First runner attempt used nonexistent root node_modules/vitest; corrected to installed Admin Vitest via package resolution. That path error was not a failing test.

## User reminders covered
All admission-path structured name and demographic/address/family round-trips.
Existing matched parent cannot be renamed through linking; stable one-admission retry.
Promoted-session subject clear/all/toggle authorizes effective session membership without Save Identity workaround; older assessment rows/snapshots preserved.

## Remaining
B2 actual UI payloads, profile reopen, class dialog, contact/address/settings/provision state.
B3 connection/history/notifications.
B4 parent grants/drafts/immediate apply.
Attested browser QA still blocked by missing private isolated profile; no alternate dev/production verification.
No pushes, PRs, deployments or live emails.
