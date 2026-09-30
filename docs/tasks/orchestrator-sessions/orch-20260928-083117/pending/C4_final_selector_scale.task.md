# Task C4: Fix confirmed Admin selector scale blocker

## Agent setup
Read `AGENTS.md`, generated Convex guidelines, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{spec.md,design.md,results/C1.md,results/C3.md}`, `resultPublication.ts:getReleaseContext`, Admin release page/panel/tests. This is a final pre-PR review correction; keep it narrow.

## Objective
A school with >256 historical publications must still inspect existing archived releases and publish a new eligible active class through Admin. A school with >256 classes/sessions/terms must not be locked out by a whole-school selector cap. Keep exact tuple validation/server authorization.

## Scope
- Replace global 257 school rows / 256 throw in getReleaseContext with bounded filtered or paginated selectors. If using pagination, use Convex paginationOptsValidator and pass args unchanged to .paginate(), with next-page UI or a search/lookup by scoped tuple, and preserve archived published tuple discovery. Avoid reading all releases just to decide archived visibility.
- Keep active session/term/class selection easy on mobile. Show inactive terms as blocked by historical policy when applicable rather than silently promise a release.
- Add backend and UI regression for 257+ historical releases and ability to select archived released tuple, plus active release option; include >256 class/terms if practical. No school-wide expensive fanout. Don't weaken parent gate or release readiness.
- Run Admin and Convex typechecks, focused tests, targeted lint, theme audit; write `results/C4.md` with verification, pagination/lookup limitations and deployment index prerequisite.

## Definition of done
No global publications count throws in Admin selectors, selected archived released tuple remains inspectable, active eligible tuple selection works at large school, no unauthorized or wrong-school IDs. Tests demonstrate 257+ case.

## Expected artifacts
Admin UI and `resultPublication.ts` selector changes/tests, `results/C4.md`.

## Constraints
Only isolated result-publication worktree. No portal.ts or FR-023 edits, no commit/push/deploy. Preserve pause/exclusion behavior and existing frozen read.

## Dependencies
B3, C1-C3, final standards review. Orchestrator must review before PR.

## Verification/review checkpoint
Orchestrator independently checks large-school admin fixture, typechecks and PR release checklist.
