# Task G1: Define admissions architecture
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-genesis` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
| Skill | Why |
| --- | --- |
| `takomi` | Optional overlay for this task; use it only if installed and genuinely helpful |
## Objective
Freeze admissions domain, payment entitlement, applicant lifecycle, conversion, security, and API contracts.
## Scope
- Admissions domain model
- Paystack entitlement/idempotency
- Guardian and child lifecycle
- Documents and sensitive data
- Review and decision workflows
- Accepted applicant conversion
- Testing and phased build plan
## Context
Parent session: orch-20260722-114501

Task title: Define admissions architecture
## Definition Of Done
- Architecture and ADR are authored
- State machines and indexes are explicit
- Tenant/security/retention controls are concrete
- Foundation commit requirements are identified
## Expected Artifacts
- docs/features/AdmissionsApplicationPlatformArchitecture.md
- docs/decisions/ADR-AdmissionsApplicationSurfaceAndLifecycle.md
## Dependencies
- none
## Constraints
- Complete the task within scope.
- Use the assigned workflow and any listed skill/context overlays when they are available; otherwise rely on the harness defaults and repo source of truth.
- Report blockers clearly.
- Summarize what changed and what remains.