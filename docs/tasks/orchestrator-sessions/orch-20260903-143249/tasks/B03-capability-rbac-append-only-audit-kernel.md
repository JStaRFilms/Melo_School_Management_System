# Task B-03 / M2: Capability RBAC and Append-Only Audit Kernel (H2/F1)

## Objective
Replace broad administrative authority with granular capabilities, strict delegation ceilings, and an append-only redacted audit logging kernel.

## Scope
- **Schema & Indexes** (`packages/convex/schema.ts`):
  - `roleTemplates`: Standard factory templates (`proprietor`, `principal`, `academic_director`, `exam_officer`, `bursar`, `registrar`, `staff_administrator`) with group or branch scope.
  - `membershipRoleAssignments`: Assigns one or more role templates to a `branchMembership`.
  - `membershipDirectGrants`: Explicit capability grants overriding templates.
  - `membershipDirectRestrictions`: Explicit capability restrictions subtracting from templates.
  - `delegationCeilings`: Proprietor-defined ceiling of capabilities a manager is permitted to delegate.
  - `auditEvents`: Append-only audit log with actor, context, module, action, target, outcome, safe before/after summaries, and correlation ID.
  - `auditAlerts`: Notifications generated for Tier 1 Critical security/financial events.
- **Capability Evaluator & Preview Engine** (`packages/convex/functions/academic/rbac.ts`):
  - Evaluator formula: `EffectivePermissions = (Union(RoleTemplates) + DirectGrants) - DirectRestrictions`.
  - Delegation rules enforcement:
    - Manager cannot edit own permissions.
    - Manager cannot edit Proprietor, Platform Super Admin, or users equal/superior in hierarchy.
    - Manager can only grant capabilities within their proprietor-defined `delegationCeiling`.
    - Possession of capability != right to delegate.
  - Read-only permission preview query.
- **Append-Only Redacted Audit Writer** (`packages/convex/functions/academic/audit.ts`):
  - Internal audit event writer with pre-write redaction pipeline (passwords/tokens -> `[REDACTED_SECRET]`, bank accounts masked to `***-****-1234`).
  - Strict append-only semantics (zero update/delete mutations registered).
  - Tiered alerting dispatch for sensitive modifications (bank details, role/permission updates, ownership recovery).
  - RBAC-scoped audit query with search, date range, module, action, and actor filters.
- **Migration & Backfill Runner (MX-03 & MX-04)** (`packages/convex/functions/academic/rbacMigration.ts`):
  - Seed factory role templates.
  - Backfill existing school admins with full baseline access to prevent lockout.
- **Integration Tests** (`packages/convex/functions/academic/__tests__/rbacAudit.integration.test.ts`):
  - Evaluator tests (union + grants - restrictions).
  - Anti-self-escalation and superior-edit rejection.
  - Delegation ceiling violation rejection.
  - Audit immutability, redaction, and Tier 1 alert emission.

## Definition of Done
- Backend, not navigation, enforces capabilities.
- Manager ceiling and proprietor recovery rules hold.
- Audit is append-only, redacted, and tenant-scoped.
- Sensitive alerts fire without routine notification noise.
- All integration tests pass.

## Dependencies
- B-02 / M1 complete (satisfied).
- D-02 architecture frozen (satisfied).
