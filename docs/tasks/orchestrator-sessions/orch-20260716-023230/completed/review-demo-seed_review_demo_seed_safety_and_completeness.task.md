# Task review-demo-seed: Review demo seed safety and completeness
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Audit the implementation for production safety, data integrity, visible-flow completeness, and Convex correctness before development execution.
## Scope
- Code diff
- Tests and typecheck evidence
- Tenant isolation
- Auth and credential security
- Media provenance and storage
- All visible-flow dataset coverage
## Context
Parent session: orch-20260716-023230

Task title: Review demo seed safety and completeness
## Definition Of Done
- No non-demo tenant can be modified
- No live payment or AI operations can be triggered
- Schema relationships and validators are correct
- The seed is safely rerunnable
- Verification gaps and blockers are explicit
## Expected Artifacts
- Review findings with severity and exact paths
- Go/no-go recommendation for development execution
## Dependencies
- build-demo-seed
## Constraints
- Read Convex AI guidelines.
- Review only after implementation tests pass.
- Do not deploy or mutate data.