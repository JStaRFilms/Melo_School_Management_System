# Task B2: Gate every family graded-result read

## Agent setup

### Workflow to follow
Takomi Vibe Build. Backend privacy contract and integration tests before frontend work.

### Prime agent context
Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{master_plan.md,spec.md,design.md,results/B1.md}`, `packages/convex/functions/academic/resultPublication.ts`, `packages/convex/functions/portal.ts`, `packages/convex/functions/academic/portalIdentity.ts`, and `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress/docs/tasks/orchestrator-sessions/orch-20260928-082626/portal-agent-handoff.md` read-only.

### Optional skill/context overlays
Convex functions and security; unslop for neutral withheld copy. FR-023 belongs to another worktree.

## Objective
Replace the family-facing live graded builder in the single portal workspace query with a release-gated, pinned certified report read. Return no score-bearing data before explicit release across selected card, history, summaries and notifications.

## Scope
- `portal.ts` selected report and history must use frozen eligible student + exact school/session/term/class release and issued snapshot from B1, no live `buildStudentReportCard` for family reads. Hydrate permitted snapshot image URLs safely.
- Resolve historical class from released issued evidence/frozen membership, not current class; fail closed for ambiguous same-term class, cross-school or non-enrolled student. Disallow mismatched explicit session/term IDs and unknown IDs falling back to active term. Keep inactive historical released reports accessible per B1 rules.
- `selectedResultState`: `released | withheld | no_eligible_record` if needed for UI; history released rows only; no false zeros or pre-slice before filtering. Bound iterations and cap reads. No old-term summary mistaken as current selected term.
- Remove pending-mark or draft-comment notifications; only released snapshot-derived notifications. Event/billing untouched.
- FR-023 narrative integration: do not modify its worktree or implement narrative here. Make portal changes localized and record conflicts/typed-contract assumptions in B2 handoff. Never add a narrative-to-graded fallback when FR-023 lands.
- Convex tests exercising parent and student membership, partial drafts, certified-but-withheld, released immutable snapshot after subsequent edits, history and notifications, invalid IDs, cross-family, cross-school, historical class/promotion, excluded/late student, pagination/bounds; use existing portal fixtures where practical. Do not claim narrative integration passes without code present.

## Definition of done
No parent/student Convex payload contains marks, grades, comments, averages, pending counts, result URLs or assessment-progress hints for an unreleased selected tuple; older eligible released history may remain separately visible. Released data equals pinned certified snapshot. Backend typecheck and focused tests pass.

## Expected artifacts
`packages/convex/functions/portal.ts`, focused Convex tests and `docs/tasks/orchestrator-sessions/orch-20260928-083117/results/B2.md` in this worktree.

## Constraints
Do not touch original checkout, FR-023 worktree or UI. No commits, merges, deploys or migration. Review publication helper contract; report defects rather than silently weaken it. Read generated Convex guidelines first. No current class guess for historical records.

## Dependencies
B1 backend complete. B4 family UI and integrated FR-023 review depend on this task.

## Verification/review checkpoint
Orchestrator and independent security reviewer inspect API responses for privacy and tenant leakage before UI merge or PR.
