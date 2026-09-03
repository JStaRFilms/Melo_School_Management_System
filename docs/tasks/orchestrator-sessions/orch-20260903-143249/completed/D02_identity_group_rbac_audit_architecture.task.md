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

## Completion Status
- **Status**: Completed (2026-09-03)
- **Artifact Written**: `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md` (Version 1.0.0, 940+ lines)
- **Verification Summary**:
  - **F2 Canonical Identity & Multi-Branch Tenancy**: Mermaid ERD, Convex schemas for `persons`, `branchMemberships`, `schoolGroups`, and `schoolGroupBranches` with strict indexes; server-side session scoping contract (`resolveActiveMembership`) enforcing zero client trust; multi-phase legacy `users` bridge with bi-directional synchronous projection (`syncLegacyUserProjection`).
  - **H2 Granular RBAC & Authority Ceiling**: Decoupling of cosmetic `displayTitle` from typed authorization capabilities; 7 factory base templates (`proprietor`, `principal`, `academic_director`, `exam_officer`, `bursar`, `registrar`, `staff_administrator`); closed catalog of 47 typed capabilities across 8 domains with 11 sensitive capabilities segregated; mathematical union/grant/restriction evaluator formula `(⋃ Templates ∪ DirectGrants) ∖ DirectRestrictions` with pure read-only preview engine; six strict delegation ceiling rules (anti-self-escalation, anti-superior modification, ceiling bounds, possession != delegation); audited break-glass recovery for Platform Super Admin.
  - **F1 Append-Only Audit & Redaction**: Consolidated `auditEvents` table with typed actor kinds, context scopes, and 7-year/permanent statutory retention tiers; pre-write sanitization pipeline masking bank accounts to `***-****-1234`, masking government IDs, stripping credentials/tokens to `[REDACTED_SECRET]`, and excluding binary payloads; 3-tier alerting architecture (Tier 1 Critical real-time leadership alert, Tier 2 Warn in-app badge, Tier 3 Info silent audit); RBAC-scoped CSV/PDF export contracts.
  - **Endpoint Enforcement Inventory**: 26 public and internal Convex mutations, queries, and actions cataloged across Academic, Admissions, Finance, Staff/RBAC, Settings, Assets, Audit, and Platform recovery with required capabilities, tenant checks, emitted events, and alert tiers.
  - **Threat Model & Negative-Test Matrix**: 10 concrete attack vectors (`SEC-NEG-01` through `SEC-NEG-10`) specifying exact preconditions, execution payloads, and authoritative 403 Forbidden / typed denial assertions.
