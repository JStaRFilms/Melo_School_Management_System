# Task G1: Audit family results paths and write release contract
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-genesis` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Write an implementable contract for class/term result publication, including all parent/student reads and rollout.
## Scope
- packages/convex/functions/portal.ts
- packages/convex/functions/academic/reportCards.ts
- packages/convex/schema.ts
- academic enrollment/transfer and admin certification flows
- docs/tasks/orchestrator-sessions/orch-20260928-083117/spec.md
## Context
Parent session: orch-20260928-083117

Task title: Audit family results paths and write release contract
## Definition Of Done
- All family-facing result/summary/notification routes enumerated
- State and readiness model with historical enrollment and partial exceptions specified
- Authorization, idempotence, deploy order and rollback spelled out
- Implementation task boundaries identified
## Expected Artifacts
- docs/tasks/orchestrator-sessions/orch-20260928-083117/spec.md
## Dependencies
- none
## Constraints
- Use absolute worktree cwd /Users/toji/Documents/johnsax/Melo_School_Management_System-result-publication.
- Read local AGENTS.md and Convex guidelines before code inspection.
- Do not edit implementation or original checkout.
- Report any requirement requiring a user decision rather than guessing.