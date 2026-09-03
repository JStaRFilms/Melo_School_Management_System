# Task B03 / M2: Capability RBAC and Append-Only Audit Kernel (H2/F1) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M2 / PR-C  
**Author**: Security Architect & Convex Systems Engineer  

---

### 1. Schema Expansion (`packages/convex/schema.ts`)
Additive schema definitions and indexes were implemented strictly adhering to `packages/convex/_generated/ai/guidelines.md` and `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md`:
- **`roleTemplates` Table**:
  - Fields: `code` (e.g. `proprietor`, `principal`, etc.), `name`, `description`, `scope` (`global | group | branch`), `schoolId`, `groupId`, `capabilities` (`string[]`), `isSystem`, `createdAt`, `updatedAt`.
  - Indexes: `by_code: ["code"]`, `by_scope_and_school: ["scope", "schoolId"]`, `by_group: ["groupId"]`.
- **`membershipRoleAssignments` Table**:
  - Fields: `membershipId`, `roleTemplateId`, `roleTemplateKey`, `assignedBy`, `assignedAt`.
  - Indexes: `by_membership: ["membershipId"]`, `by_role: ["roleTemplateId"]`, `by_membership_and_role: ["membershipId", "roleTemplateId"]`.
- **`membershipDirectGrants` Table**:
  - Fields: `membershipId`, `capability`, `grantedBy`, `grantedAt`, `reason`.
  - Indexes: `by_membership: ["membershipId"]`, `by_membership_and_cap: ["membershipId", "capability"]`.
- **`membershipDirectRestrictions` Table**:
  - Fields: `membershipId`, `capability`, `restrictedBy`, `restrictedAt`, `reason`.
  - Indexes: `by_membership: ["membershipId"]`, `by_membership_and_cap: ["membershipId", "capability"]`.
- **`delegationCeilings` Table**:
  - Fields: `membershipId`, `allowedCapabilities` (`string[]`), `updatedBy`, `updatedAt`.
  - Indexes: `by_membership: ["membershipId"]`.
- **`auditEvents` Table** (Strict Append-Only):
  - Fields: `eventId`, `timestamp`, `actorKind` (`user | platform_admin | system`), `actorPersonId`, `actorMembershipId`, `actorEmailSnapshot`, `actorIpHash`, `schoolId`, `groupId`, `module`, `action`, `targetType`, `targetId`, `outcome` (`success | denied | failed`), `safeSummary`, `beforeSummary`, `afterSummary`, `correlationId`, `retentionClass` (`operational_7yr | permanent_statutory`), `alertTier` (`tier1_critical | tier2_warn | tier3_info`), `createdAt`.
  - Indexes: `by_school_and_timestamp: ["schoolId", "timestamp"]`, `by_group_and_timestamp: ["groupId", "timestamp"]`, `by_module_and_action: ["module", "action"]`, `by_actor_and_timestamp: ["actorPersonId", "timestamp"]`.
- **`auditAlerts` Table**:
  - Fields: `alertId`, `schoolId`, `eventId`, `tier` (`tier1_critical | tier2_warn | tier3_info`), `title`, `message`, `targetRecipientPersonIds`, `isDismissed`, `dismissedAt`, `dismissedBy`, `createdAt`.
  - Indexes: `by_school_and_dismissed: ["schoolId", "isDismissed"]`, `by_event: ["eventId"]`.

---

### 2. Capability Engine & Evaluator (`packages/convex/functions/academic/rbac.ts`)
Implemented the authoritative capability catalog and mathematical evaluation engine:
- **Canonical Capability Catalog**:
  - 47 typed capabilities across 8 domains (`academic`, `enrollment`, `finance`, `staff`, `settings`, `assets`, `audit`, `system`), plus canonical aliases (`audit.view`, `staff.manage`, `permissions.manage`, `bank.manage`, `export.financial`).
  - Identified 11 sensitive capabilities carrying profound security/financial risk (`staff.permissions.manage`, `finance.bank_details.manage`, `academic.report_cards.publish_final`, `enrollment.admissions.override_number`, etc.).
- **Mathematical Capability Evaluator (`evaluateEffectiveCapabilities`)**:
  - Evaluates: `EffectivePermissions = ( ⋃ TemplateCapabilities ) ∪ DirectGrants ∖ DirectRestrictions`.
  - School Proprietor bypass: School group owner holds full capability set.
  - Lockout prevention: Existing admin memberships without explicit template assignments automatically receive baseline administrative capabilities.
- **Backend Capability Guard (`requireCapability`) & Query (`hasViewerCapability`)**:
  - Resolves active branch membership and verifies caller holds required capability.
  - Throws clean, typed `ConvexError({ code: "FORBIDDEN", message: "..." })` on unauthorized access.
  - Platform super admin bypass for audited emergency maintenance.
- **Role & Capability Management Mutations**:
  - `assignRoleToMembership`: Enforces anti-self-edit, no superior edit, and manager delegation ceiling rules.
  - `grantDirectCapability`: Replaces conflicting restrictions, asserts delegation ceiling.
  - `restrictDirectCapability`: Replaces conflicting grants.
  - `setDelegationCeiling`: Strictly restricted to School Proprietor or Platform Super Admin.
  - `previewEffectiveCapabilities`: Pure, read-only preview engine evaluating candidate permissions without database mutation.

---

### 3. Append-Only Redacted Audit Kernel (`packages/convex/functions/academic/audit.ts`)
Implemented centralized audit logging and multi-tier alerting under NDPA 2023 Section 24 and statutory compliance:
- **Pre-Write Sanitization Pipeline (`sanitizeAuditSummary`)**:
  - Masks 10-digit NUBAN bank account numbers to `***-****-1234`.
  - Masks 11-digit Government IDs (NIN) to `***-****-1234`.
  - Redacts passwords, bearer tokens, API keys, and JWT credentials to `[REDACTED_SECRET]`.
- **Strict Append-Only Writer (`recordAuditEventHelper` & `recordAuditEventInternal`)**:
  - Inserts into `auditEvents`. **Zero update or delete mutations are registered on this table**.
  - Multi-tier alert dispatch: Automatically generates an `auditAlerts` record when `alertTier === "tier1_critical"`.
- **Audit Queries & Alert Mutations**:
  - `listAuditEvents`: Enforces `audit.branch.view` capability; filters by module, action, date range with bounded pagination.
  - `listAuditAlerts`: Queries active/dismissed alerts.
  - `dismissAuditAlert`: Marks critical alert dismissed by authorized administrator.

---

### 4. Migration & Seeding Engine (`packages/convex/functions/academic/rbacMigration.ts`)
Implemented MX-03 and MX-04 transition mechanisms:
- **`seedFactoryRoleTemplates`**: Idempotently seeds standard factory templates (`proprietor`, `principal`, `academic_director`, `exam_officer`, `bursar`, `registrar`, `staff_administrator`).
- **`backfillExistingAdminCapabilities`**: Cursor-paginated batch runner that assigns baseline `principal` (or `proprietor`) role templates to pre-existing administrative `branchMemberships` to prevent lockout.

---

### 5. Integration Test Verification (`packages/convex/functions/academic/__tests__/rbacAudit.integration.test.ts`)
Configured test suite with `import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])`.

All 8 test scenarios passed successfully:
1. **Evaluator Formula Accuracy**: Evaluator accurately computes `(Templates ∪ Grants) ∖ Restrictions` and matches `previewEffectiveCapabilities`.
2. **Anti-Self-Escalation**: Delegated manager cannot assign roles, grant capabilities, or place restrictions on their own membership.
3. **Delegation Ceiling Enforcement**: Delegated manager cannot grant capabilities or assign templates exceeding their proprietor-defined ceiling.
4. **Superior Authority Protection**: Delegated manager cannot modify role assignments or permissions of the School Proprietor.
5. **Audit Sanitization**: Raw bank numbers (`0123456789`), NINs, and secrets (`Bearer eyJ...`) are redacted before database persistence.
6. **Tier 1 Critical Alerting**: Sensitive financial/administrative actions automatically emit dismissible `auditAlerts`.
7. **Audit Immutability & Access Boundary**: Audit log has zero delete/update endpoints; unprivileged users receive 403 Forbidden.
8. **Admin Migration & Lockout Prevention**: Legacy admins resolve baseline capabilities pre-backfill and receive explicit role assignments post-backfill.

---

### 6. Verification Results
- `pnpm --filter @school/convex typecheck`: **0 errors (Exit Code 0)**.
- `pnpm --filter @school/convex test rbacAudit.integration.test.ts`: **8 passed (Exit Code 0)**.
- Full suite `pnpm --filter @school/convex test`: **24 passed, 129 tests passed (Exit Code 0)**.
