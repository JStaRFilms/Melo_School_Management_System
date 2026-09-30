# Task C5: Correct subject-evidence capacity before source merge

## Agent setup
Follow Vibe Build, bounded corrective pass only. Read AGENTS.md, packages/convex/_generated/ai/guidelines.md, resultPublication.ts and its tests, session spec/PR88.md. Codex root 4139166687 and issue #92 describe the confirmed bug. Owner approved fixing this bug before merging; no broad review cycle or future backlog implementation.

## Objective
Allow a normal <=80-student fully certified class with >512 subject rows to release, while preserving complete evidence, roster uniqueness, transaction limits, review-token freshness, isolation and atomic frozen publication.

## Scope
Modify resultPublication.ts readiness evidence collection and focused Convex test only. Class-level selection/assessment evidence should be gathered in indexed bounded pages/iteration, deduplicate candidate students and enforce MAX_ROSTER on unique student IDs, not subject rows. Keep an explicit independent read/byte/evidence budget and clear fail-closed error at that budget, never silently truncate. Avoid unbounded collect and avoid only removing bounds. Per-student evidence/duplicate/class conflict checks, current active term restriction, exclusions and audit semantics remain.

## Definition of done
50 students x 11 subjects (550 selection/assessment rows) can complete readiness and atomic release with certified cards. >80 unique candidates still blocks with no partial publication. Extra candidate discovered after row 512 invalidates a stale token, foreign/conflicting evidence does not disappear. Typecheck and focused tests pass.

## Expected artifacts
resultPublication.ts, publication tests, results/C5-capacity.md with chosen budgets and verification.

## Constraints
Work only in result-publication worktree; do not commit/push/merge/rebase/deploy or edit FR-023 worktree. Do not edit portal.ts/schema/admin UI. Parent will separately reconcile updated master which now includes narrative PR #89; leave merge operations to parent.

## Dependencies and verification
Current PR #88 at 20ea12f, issue #92, owner merge approval conditional on fixing it. Parent reruns tests, then reconciles master and does a targeted merge check, not another broad review.
