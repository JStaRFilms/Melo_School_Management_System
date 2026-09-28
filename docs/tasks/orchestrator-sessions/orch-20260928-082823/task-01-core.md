# Task 01: session scoring contract and server

## Objective
Implement user-approved session-scoped editable assessment contributions, safe same-session regrade, legacy compatibility, and auditable impact preview. See `master-plan.md`. Work only in the scoring worktree.

## Scope
- `packages/shared/src/exam-recording` calculations, validation, types and tests; five configurable numeric values: ca1Max, ca2Max, ca3Max, examRawMax, examContributionMax. Three presets are starter values, not special runtime modes. Preserve old exported functions where necessary for compatibility; migrate live calculation paths.
- Convex schema, `functions/academic/settings.ts`, session policy resolution, saves, previews, regrade/audit/job state, score entry and migration/import/report derivation as necessary. Honor group/branch policy and sessions without explicit policies. Do not touch grading bands definition. Implement safe bounded regrade with consistent read/print behavior and guarded concurrent writes; never report completion before every row updated. Use staged index if required. Detect invalid existing raw scores across whole session before activation. Preserve issued report payloads and mark stale issued reports.
- Focus tests for arbitrary weights, legacy fallback, session isolation, invalid preflight, concurrency, audit and large-batch behavior. Ensure update-existing scores carry correct policy provenance. Read Convex guidelines before writing.

## Definition of done
Editable policy `/80 -> 50` computes correctly; 20/20/10 plus exam 50 totals 100; scope is per session; previews provide authoritative counts and bounded actionable errors; server rejects changes for over-limit raw scores; apply requires explicit confirmation/version check and logs; ongoing regrade has safe reader/writer behavior; other sessions and immutable issued documents unchanged; key automated tests pass. Document what UI needs to call and any unimplemented gaps. If unable to complete, report honestly rather than claiming done.

## Instructions
Use `pnpm` tests and typecheck in isolated worktree. For very large sessions, either stage derived versions and switch atomically, or explicitly block all session reads/prints/certification until a bounded guarded regrade completes, including a resumable failure path. Avoid unbounded mutation and unbounded error payloads. Preserve tenant scoping and existing capabilities. Do not commit or open a PR; hand off to orchestrator for review.
