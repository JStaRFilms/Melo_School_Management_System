# Task design-demo-genesis: Design deterministic full-demo seed
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Specify the full demo dataset and safe reset/population architecture from the Genesis audit and confirmed user decisions.
## Scope
- Tenant-scoped reset and idempotency
- Data volumes and insertion dependencies
- Better Auth account reconciliation
- Synthetic photo-like portrait storage
- All visible academic, reporting, billing, event, knowledge, and planning flows
- Development validation and production launch gate
## Context
Parent session: orch-20260716-023230

Task title: Design deterministic full-demo seed
## Definition Of Done
- Dataset volumes and representative states are explicit
- Schema table insertion and deletion order is defined
- Live external-system tables intentionally excluded are named
- Production requires a final explicit confirmation
- Validation matrix covers admin, teacher, and portal
## Expected Artifacts
- Implementation-ready architecture brief
## Dependencies
- none
## Constraints
- Use internal Convex mutations for destructive writes.
- Use a public action only as a strongly gated runner.
- Keep gateway secrets, OCR jobs, AI logs, and rate-limit counters empty.
- Preserve deterministic demo login emails currently used by e2e where practical.
- Use synthetic portraits with local/frozen provenance.