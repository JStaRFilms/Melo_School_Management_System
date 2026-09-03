# Task B-02 / M1: Canonical Identity and Group Membership Kernel (F2)

## Objective
Add canonical identity, explicit branch memberships, school groups/links, and compatibility resolvers without rekeying existing branch records.

## Scope
- Schema additions in `packages/convex/schema.ts`:
  - `persons` table keyed by canonical `authTokenIdentifier` from Better Auth / JWT.
  - `branchMemberships` table (`personId`, `schoolId`, `status: active|suspended|archived`, `joinedAt`, `defaultBranch`) with unique index `by_person_and_school` and index `by_school_and_person`.
  - `schoolGroups` table (`name`, `slug`, `proprietorPersonId`, `status`, `createdAt`, `updatedAt`).
  - `schoolGroupBranches` table (`groupId`, `schoolId`, `isHeadquarters`, `linkedAt`) with unique index `by_group_and_school` and index `by_school`.
  - Optional `personId` on existing `users` table for transition linking.
- Internal resolvers and compatibility layer (`packages/convex/functions/academic/auth.ts`):
  - Server-side auth resolution from `ctx.auth.getUserIdentity()`.
  - Resolution: `tokenIdentifier` -> `persons` -> `branchMemberships(personId, targetSchoolId)`.
  - Legacy `users` projection maintenance during the bridge window.
- Durable migration runner (`packages/convex/functions/academic/identityMigration.ts` or MX-01/MX-02 runner):
  - Batch backfill populating `persons` and `branchMemberships` from existing `users` without mutating existing operational record `schoolId`s.
  - Idempotent and progress-tracked via `migrationRuns`.
- Comprehensive integration tests:
  - Multi-branch person authentication (proprietor across branches, teacher across branches).
  - Cross-branch negative tests (access denied to unauthorized branch).
  - Legacy auth fallback parity during transition window.

## Definition of Done
- A person may hold explicit memberships across multiple branches.
- Current users retain full access via dual-read compatibility bridge.
- Existing records (`students`, `classes`, `studentInvoices`, etc.) retain their branch `schoolId` untouched.
- Group linking never creates implicit branch access.
- Tests passing for positive multi-membership and negative cross-tenant access.

## Expected Artifacts
- Additive schemas and indexes in `packages/convex/schema.ts`.
- Core auth and resolution functions in `packages/convex/functions/academic/auth.ts`.
- Additive migration runner for MX-01 and MX-02.
- Integration tests in `packages/convex/functions/academic/__tests__/identityTenancy.integration.test.ts`.
- Completed task record.

## Dependencies
- B-01 / M0 complete (satisfied).
- D-02 architecture frozen (satisfied).
- D-05 migration runbook approved (satisfied).
