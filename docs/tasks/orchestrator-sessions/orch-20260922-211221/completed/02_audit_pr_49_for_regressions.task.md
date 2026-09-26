# Task 02: Audit PR #49 for regressions

## Agent setup
### Workflow to follow
Takomi Build in read-only review mode.
### Prime agent context
Read `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/project_requirements.md`, `docs/tasks/orchestrator-sessions/orch-20260922-211221/master_plan.md`, PR #49, and every item PR merged into `chore/consolidation-stack`.
### Optional skill and context overlays
Use `code-review`, `code-intelligence`, `convex`, `security-audit`, `engineering-principles`, `avoid-feature-creep`, and `unslop`.
## Objective
Find reproducible regressions and requirement violations in the three-dot diff from `origin/master` to PR #49.
## Scope
Review specification coverage, repository standards, auth and tenant boundaries, payment verification, admissions conversion, identity resolution, academic and grading rules, shared validators, proxy routes, shared UI primitives, every migrated caller, and historical review comments.
## Context
The branch combines 22 consolidation items. Four product decisions remain intentionally unresolved and must not be guessed.
## Definition of done
- Every changed domain has an owner and caller map.
- Standards and specification findings remain separate.
- Security findings identify a concrete exploit or violated boundary.
- Each defect includes location, behavior, proof, severity, and the smallest fix.
- Speculative cleanup is excluded.
## Expected artifacts
- Review findings ledger
- Changed-domain and caller map
- Historical feedback ledger
## Constraints
Read-only. Do not edit, resolve comments, push, deploy, or make product decisions.
## Dependencies
Task 01.
## Verification
Confirm the fixed point, non-empty diff, and every finding on the current head.
