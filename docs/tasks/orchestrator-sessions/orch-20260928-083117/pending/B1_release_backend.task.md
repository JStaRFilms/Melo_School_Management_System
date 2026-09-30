# Task B1: Implement graded class-release backend

## Agent setup

### Workflow to follow
Takomi Vibe Build. Implement and test one backend slice; report any unsound historical-roster assumptions before enabling publication.

### Prime agent context
Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/master_plan.md`, `spec.md` especially owner decisions and FR-023 integration note, `design.md`, and the existing `packages/convex/functions/academic/{reportCards,studentClassMembership,portalIdentity,assessmentRecords}.ts`, `packages/convex/schema.ts`, tenant purge/branch-split inventories and relevant Convex tests.

### Optional skill/context overlays
Use `convex` functions/schema/security practices; `unslop` for messages. Do not touch FR-023 worktree. No frontend code or `portal.ts` in this task.

## Objective
Introduce a safe, explicit and auditable school/session/term/class release workflow for *graded* issued report cards, with an admin-only reasoned exclusion decision and a frozen included roster. Provide an internal read helper for B2 to use for parents.

## Scope
- Persist release metadata and frozen student inclusion/exclusion rows, indexed by exact tuple/student. Add tables to applicable purge/inventory lists; no silent backfill.
- Staff-authorized paginated/bounded readiness for the exact class/session/term: deterministic roster identity, complete verified certified snapshots, duplicate/ambiguous/historical-policy blockers, counts and fresh review token. Use tenant-scoped current/historical enrollment evidence, never infer from a student's current class alone for history. Bound Convex reads/writes, fail closed if roster cannot be proven or fits no transaction budget.
- School-admin-only, named and reasoned exclusion with audit. Exam officers with existing `academic.report_cards.publish_final` can release a ready roster, including previously reviewed exclusions; school/class/session/term consistency verified. Exclusion records cannot be silently edited after release.
- Atomic release mutation rechecks readiness and token, refuses empty or uncertain rosters, freezes membership, audits once and makes identical retries idempotent. New students or future certification are never auto-included. No timed/automatic publication or revocation workflow.
- Export a typed backend helper for B2 that resolves released matching issued snapshot plus frozen eligibility with tenant checks. Return no report when missing/ambiguous; do not call the live builder in family code.
- Focused `convex-test` cases for cross-school IDs, permission denial, exclusion authorization/reason, missing or duplicate certification, partial and historical uncertainty, stale token, idempotent retry, late addition freeze and a successful class release. Mark cases blocked by legacy fixtures explicitly.

## Context
Owner chose exam-officer release and school-admin-only exclusions. Older cards without certifiable grading policy remain hidden. FR-023 narrative mode is a parallel branch; don't import its code, but keep helper graded-specific so future narrative must not fall back to graded. Keep staff previews unchanged.

## Definition of done
- Production read gate can fail closed through a tested exact-tuple, frozen-eligible, issued-only helper; no schema/validator drift.
- Tenant isolation, roster completeness, authorization, readiness concurrency and audit are tested, not just inferred from UI.
- Migration implications documented for existing unreleased reports and no implicit public release.
- Tests/typecheck relevant to touched backend files run with results recorded. If an authoritative roster is impossible with current data, leave release blocked and report a concrete remedy, not a guessed publication.

## Expected artifacts
`packages/convex/schema.ts`, `packages/convex/functions/academic/resultPublication.ts` plus focused helper/tests and applicable tenant inventory changes; a brief verification note under `docs/tasks/orchestrator-sessions/orch-20260928-083117/results/B1.md`.

## Dependencies
G1 and D1 complete. B2 portal guard depends on B1 helper. B3 Admin UI depends on B1 endpoints. FR-023 is independently developed and never edited here.

## Constraints
Work only in `/Users/toji/Documents/johnsax/Melo_School_Management_System-result-publication`, based at `origin/master` commit `23c4880`. No git rebase/merge/push, no production or deploy. Leave `packages/convex/functions/portal.ts` untouched for B2. Follow Convex project's generated guidelines over training patterns. Never write to dirty original checkout.

## Verification/review checkpoint
Orchestrator reviews backend diff and tests for fail-closed roster, authorization and transaction boundedness before B2 begins. Separate specialist reviews after integration.
