# Task D02: Identity, group, RBAC, and audit architecture (F2/H2/F1)
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with `docs/tasks/orchestrator-sessions/orch-20260903-143249/product-decisions.md` (F1, F2, H2), `task-packets.md` (D-02), `packages/convex/functions/academic/auth.ts`, and `packages/convex/schema.ts`.
### Optional Skill / Context Overlays
| Skill | Why |
| --- | --- |
| `security-audit` | Authority boundaries, delegation ceilings, threat model |
| `convex` | Schema definitions, index requirements, server-side auth |
## Objective
Freeze data model, API contracts, authority model, and migration bridge.
## Scope
- Canonical person/membership/group model
- Legacy users bridge
- Capability catalog & templates
- Union/grant/restriction evaluator
- Proprietor recovery & manager ceiling
- Audit event schema, redaction, alert tiers, export
- Complete endpoint inventory & negative test matrix
## Context
Parent session: orch-20260903-143249
Task title: Identity, group, RBAC, and audit architecture
## Definition Of Done
- Explicitly solves multi-membership, title-vs-authority, branch scope, URL denial
- Redaction and immutability contracts frozen
- ERD and negative test matrix complete
## Expected Artifacts
- docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md
## Dependencies
- D-01 data-classification constraints (complete)
## Constraints
- Backend is authoritative security boundary
- No invented roles or unauthorized delegation

## Delivery Record

- **Historical artifact:** The initial D-task document was delivered on 2026-09-03.
- **Current authority:** The corrected feature document and master plan govern review status.
- **Evidence boundary:** This delivery record does not establish legal, provider, runtime, browser/accessibility, migration/restore, security, or release validation.

## Correction status (2026-09-03)

This completion record is superseded for review purposes by the corrected D-01–D-05 feature bundle. The artifact remains delivered, but independent milestone re-review is pending. It does not evidence legal approval, provider/runtime validation, browser/accessibility validation, migration/restore proof, or release authorization.
