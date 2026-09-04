# Task B02 / M1: Canonical Identity and Group Membership Kernel (F2) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M1 / PR-B  
**Author**: Convex Systems Architect & Data Engineer  

---

### 1. Schema Expansion (`packages/convex/schema.ts`)
Additive schema definitions and indexes were implemented strictly adhering to `packages/convex/_generated/ai/guidelines.md` and `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md`:
- **`persons` Table**:
  - Fields: `authTokenIdentifier`, `email`, `name`, `status` (`active | suspended | archived`), `primarySchoolId`, `createdAt`, `updatedAt`.
  - Indexes: `by_token_identifier: ["authTokenIdentifier"]`, `by_email: ["email"]`, `by_status: ["status"]`.
- **`branchMemberships` Table**:
  - Fields: `personId`, `schoolId`, `status` (`active | suspended | archived`), `isDefaultBranch`, `legacyUserId`, `joinedAt`, `updatedAt`.
  - Indexes: `by_person_and_school: ["personId", "schoolId"]`, `by_school_and_person: ["schoolId", "personId"]`, `by_person_and_status: ["personId", "status"]`, `by_school_and_status: ["schoolId", "status"]`, `by_legacy_user: ["legacyUserId"]`.
- **`schoolGroups` Table**:
  - Fields: `name`, `slug`, `proprietorPersonId`, `status` (`active | archived`), `settingsVersion`, `createdAt`, `updatedAt`.
  - Indexes: `by_slug: ["slug"]`, `by_proprietor: ["proprietorPersonId"]`.
- **`schoolGroupBranches` Table**:
  - Fields: `groupId`, `schoolId`, `isHeadquarters`, `linkedAt`.
  - Indexes: `by_group_and_school: ["groupId", "schoolId"]`, `by_school: ["schoolId"]`, `by_group: ["groupId"]`.
- **`migrationRuns` Table**:
  - Fields: `sliceId`, `batchNumber`, `cursor`, `processedCount`, `failedCount`, `status` (`in_progress | completed | failed`), `startedAt`, `updatedAt`, `completedAt`, `errorMessage`.
  - Indexes: `by_slice_and_status: ["sliceId", "status"]`, `by_slice_and_batch: ["sliceId", "batchNumber"]`.
- **`users` Table Transition Bridge**:
  - Added optional `personId: v.optional(v.id("persons"))`.
  - Added index `by_person: ["personId"]`.

---

### 2. Server-Side Membership Resolution (`packages/convex/functions/academic/auth.ts`)
Implemented `resolveActiveMembership(ctx, schoolId)` and `getActiveMembership` query wrapper:
- **Server-Side Identity Derivation**: Extracts caller identity via `ctx.auth.getUserIdentity()`.
- **Platform Super Admin Bypass**: Checks `platformAdmins` table by `authTokenIdentifier`, `authId`, and `email`, granting platform admin context (`isPlatformAdmin: true`, `role: "super_admin"`) across any target branch.
- **Canonical Person Resolution**: Resolves `persons` record via `authTokenIdentifier` or `email`.
- **Explicit Branch Tenancy Boundary**: Checks `branchMemberships` via `by_person_and_school`. If active membership exists, resolves linked `legacyUserId` and returns `{ personId, membershipId, schoolId, userId, role, isPlatformAdmin: false }`.
- **Dual-Read Legacy Bridge Fallback**: If no canonical person or membership exists yet, queries `users` table scoped to `schoolId` by `(schoolId, authTokenIdentifier)` or `(schoolId, authId)`. Active legacy users are resolved seamlessly during the transition window.
- **Strict Tenant Rejection**: If neither active explicit membership nor active legacy school user exists, throws clear `ConvexError("Not authorized: User does not have an active membership in this branch")`.

---

### 3. Additive Migration Runner (`packages/convex/functions/academic/identityMigration.ts`)
Implemented MX-01 and MX-02 batch migration mutations:
- **`backfillCanonicalIdentityBatch`**:
  - Durable cursor-based batch mutation iterating through `users` via `.paginate({ numItems: batchSize, cursor })`; it clamps `batchSize` to 1–150.
  - Reuses persons only by existing `user.personId` or exact `authTokenIdentifier`; it does not reconcile by email.
  - Creates or finds a canonical `person` record and patches `user.personId`.
  - Ensures a corresponding `branchMemberships` record exists for `(personId, user.schoolId)` without touching operational records (`students`, `classes`, `studentInvoices`, etc.).
  - Inserts one long-lived `migrationRuns` record for the slice, then patches its cumulative cursor/counts across batches; `identityMigrationIssues` separately retains unresolved rows, and later caller cursors are ignored in favor of the stored cursor.
  - Self-schedules the next batch while the run is `in_progress`; no runner-level pause/cancellation state exists, so safe containment must account for already-scheduled work as documented in D-05 §3.1.
  - Fully idempotent: re-executing against already migrated users produces no duplicate records.
- **`linkSchoolToGroupInternal`**:
  - Idempotently links a school branch to a group in `schoolGroupBranches`.
  - Enforces invariant: group linking never grants implicit branch access.
- **Internal Helper Mutations**:
  - `createSchoolGroupInternal` and `createBranchMembershipInternal` for operational setup and automated test execution.

---

### 4. Integration Test Verification (`packages/convex/functions/academic/__tests__/identityTenancy.integration.test.ts`)
Configured test suite with `import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])` to exclude test files from function discovery.

All 6 test cases passed successfully:
1. **Positive (Multi-Branch Person)**: Single person holding explicit memberships in Branch A and Branch B resolves active membership in both branches with respective user/membership IDs.
2. **Negative (Cross-Branch Isolation)**: User with membership only in Branch A is rejected with `"Not authorized"` when requesting Branch B context.
3. **Negative (Group Umbrella Boundary)**: Linking Branch A and Branch B under a `schoolGroup` does NOT grant Branch A staff access to Branch B without an explicit `branchMemberships` record.
4. **Dual-Read Compatibility Bridge**: Legacy user in `users` table without `person` row is successfully resolved via fallback.
5. **Migration Batch Idempotency**: Running `backfillCanonicalIdentityBatch` twice yields identical results without creating duplicate `persons` or duplicate `branchMemberships` (2 persons, 3 memberships across 3 users).
6. **Platform Super Admin Bypass**: Active platform super admin resolves any school branch context.

---

### 5. Verification Results
- `pnpm --filter @school/convex typecheck`: **0 errors (Exit Code 0)**.
- `pnpm convex:codegen`: **Success (Exit Code 0)**.
- `pnpm --filter @school/convex test identityTenancy.integration.test.ts`: **6 passed (Exit Code 0)**.
- `pnpm --filter @school/convex test auth.test.ts`: **19 passed (Exit Code 0)**.
