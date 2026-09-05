# Task D-02: Identity, Group, RBAC, and Audit Architecture (F2/H2/F1)

## Objective
Freeze the data model, API contracts, authority model, and migration bridge that can evolve current school users without cross-branch leakage, privilege escalation, or proprietor lockout.

## Scope
- Canonical person/membership/group/link model (`persons`, `branchMemberships`, `schoolGroups`, `schoolGroupBranches`).
- Legacy bridge preserving existing `users` table and `authId` / `tokenIdentifier` resolvers during transition.
- Active branch selection contract and session scoping (branch scope is explicit in backend queries/mutations).
- Capability catalog, default templates (Proprietor, Principal, Academic Director, Exam Officer, Bursar, Registrar, Staff Administrator), custom titles vs capabilities.
- Union/grant/restriction evaluator: `(template union + direct grants) - direct restrictions`.
- Proprietor recovery, manager delegation ceiling, and permission management boundaries.
- Audit event schema, redaction rules (passwords, secrets, full bank numbers masked), retention tiers, alerts, and export contracts (CSV/PDF).
- Endpoint enforcement inventory across public/internal Convex functions, storage, and export routes.
- Threat model and negative-test matrix covering cross-branch access, lockout, privilege escalation, and direct URL denial.

## Definition of Done
- Explicitly solves multiple memberships, title-vs-authorization, owner recovery, platform support, branch/group scope, direct URL denied behavior, and redaction.
- Contains no invented roles or unauthorized delegation powers.
- Complete producer/endpoint inventory and negative test matrix.
- ERD and state/authority diagrams.

## Expected Artifacts
- `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md`
- Task completion record

## Dependencies
- D-01 data-classification constraints

## Constraints
- Backend is authoritative security boundary; UI hiding alone never counts.
- Redacted audit log; immutable event history.
