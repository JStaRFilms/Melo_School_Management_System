# Task D-02: Identity group RBAC audit architecture
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Freeze identity, tenancy, authority, audit, and migration contracts without leakage or lockout.
## Scope
- Canonical person and memberships
- Group and branch links
- Legacy identity bridge
- Capability evaluator and delegation ceilings
- Audit redaction, retention, alerts, exports
- Endpoint enforcement inventory and threat model
## Context
Parent session: orch-20260903-143249

Task title: Identity group RBAC audit architecture
## Definition Of Done
- Multiple memberships and branch scope explicit
- Owner recovery and title-versus-authorization solved
- Endpoint inventory and negative matrix complete
- ERD and authority diagrams present
## Expected Artifacts
- docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md
- Task completion record
## Dependencies
- D-01
## Constraints
- Backend authorization is authoritative
- Audit remains append-only and redacted