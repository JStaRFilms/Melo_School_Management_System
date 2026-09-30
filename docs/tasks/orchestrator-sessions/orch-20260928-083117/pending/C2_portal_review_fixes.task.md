# Task C2: Make graded family read scale by student, not school

## Agent setup
Follow Takomi Vibe Build correction pass. Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{spec.md,design.md,results/review-round-1.md,results/C1.md}`, `portal.ts`, `resultPublication.ts`, schema and portal tests. Reuse B2 coder conversation. Do not read/write FR-023 code except the handed-off note.

## Objective
Fix confirmed portal visibility and query-budget regressions when schools have >32 released classes or many terms. Preserve selected released report independent of history scan budget.

## Scope
- Add a student-keyed frozen inclusion index (and tuple fields if necessary) to `classResultPublicationStudents`; include school/session/term/class denormalized fields verified against publication/issued snapshots. No guess from mutable current class.
- Resolve selected report via exact student+session+term frozen inclusion first, with ambiguity fail-closed. Do not query all class releases; >32 other released classes must not hide the student's report. Check release and certified snapshot against pinned IDs/tenant, hydrate safe URLs.
- Build history from bounded student inclusions/released terms, not N+1 across all terms/classes. Filter released eligible reports before limit; selected report is unaffected by a long history. If history exceeds independent budget, return bounded partial released history or neutral history state, never throw away a valid selected card or expose drafts.
- Add Convex tests with >32 class releases, many terms/classes, duplicate same-term classes, invalid IDs and another school's release. Keep FR-023 typed integration seam: narrative mode must not silently fall back to graded when integrated. Do not implement narrative here.
- Coordinate backend B1 helper/index changes if necessary; maintain existing C1 tests/typecheck. Document indexed rollout and score-free `no_eligible_record` limitation in `results/C2.md`.

## Definition of done
A released eligible student can read their pinned card after the school's 33rd class release, without fetching all classes/terms; bounded history cannot make selected report disappear. Unreleased and ambiguous cases fail closed. Tests/typecheck/targeted lint pass.

## Expected artifacts
`portal.ts`, schema and `resultPublication.ts` as needed, portal and release tests, `results/C2.md`.

## Constraints
Only result-publication worktree. No Admin/Portal UI changes, other worktree edits, commit/push/merge/deploy. No public API accepting supplied user ID for authorization; portal student membership remains server-derived. No new live graded builder.

## Dependencies
B2, C1 and review-round-1. C3 UI pause follows if needed.

## Verification/review checkpoint
Orchestrator reruns Convex/portal tests and privacy review after correction; check read budget and cross-school isolation.
