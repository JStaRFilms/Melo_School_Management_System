# Task B07 / M6: Institutional Email Operations and AI Import Review Pipeline (H5/F3) - Execution Record

**Historical execution status**: COMPLETED (reported 2026-09-03)
**Current independent-review status**: FAILED / superseded for acceptance; this record is historical work only, not current implementation, provider/runtime/legal evidence, or release authorization.
**Date**: 2026-09-03
**Parent Session**: `orch-20260903-143249`
**Milestone**: M6 / PR-G
**Authors**: Integrations Builder & AI Pipeline Engineer

---

### 1. Architectural Summary & Scope

This historical execution record reported that B-07 established institutional domain management, directory mailbox provisioning with collision resolution, and a safe AI-assisted import pipeline under strict human operator review:

1. **Convex Schema Expansion (`packages/convex/schema.ts`)**:
   - `schoolEmailDomains`:
     - Fields: `schoolId`, `domain`, `status` (`pending_verification` | `verified` | `failed`), `dnsTxtRecord`, `provider` (`google` | `microsoft` | `zoho` | `none`), `isDefault`, `verifiedAt`, `createdAt`, `updatedAt`.
     - Indexes: `by_school_and_domain` on `["schoolId", "domain"]`, `by_school_and_default` on `["schoolId", "isDefault"]`, `by_domain` on `["domain"]`.
   - `institutionalMailboxes`:
     - Fields: `personId`, `schoolId`, `email`, `address`, `state` (`login_only` | `external_verified` | `provider_provisioned`), `providerType` (`google` | `microsoft` | `zoho` | `none`), `providerAccountId`, `status` (`active` | `suspended` | `archived`), `isMinor`, `minorPrivacyRequested`, `lastSyncError`, `suspendedAt`, `archivedAt`, `createdAt`, `updatedAt`.
     - Indexes: `by_person_and_school` on `["personId", "schoolId"]`, `by_school_and_email` on `["schoolId", "email"]`, `by_email` on `["email"]`.
   - `aiImportWorkspaces`:
     - Fields: `schoolId`, `importer`, `importerUserId`, `entityType` (`students` | `teachers` | `curriculum` | `grades`), `status` (`staged` | `reviewed` | `committed` | `rejected`), `rawTokenCount`, `stagedRows`, `validationErrors`, `commitResult`, `reviewedAt`, `committedAt`, `createdAt`, `updatedAt`.
     - Indexes: `by_school_and_status` on `["schoolId", "status"]`, `by_importer` on `["importer"]`.

2. **Institutional Email Operations Module (`packages/convex/functions/academic/institutionalEmail.ts`)**:
   - **Zero Mail Server Invariant (H5 / MX-09)**: Melo operates ZERO mail servers; all addressing delegates to external directory APIs (Google Workspace, Microsoft 365, Zoho Mail) or DNS verification.
   - `registerEmailDomain`: Enrolls domain under `schoolEmailDomains` with a cryptographic `melo-verify=` DNS TXT challenge token.
   - `verifyDomain`: Simulates/executes DNS TXT verification challenge and updates status (`verified` or `failed`), with append-only audit trail.
   - `proposeEmailAddresses`:
     - Implements 4-stage deterministic collision resolution pipeline:
       1. `firstname.lastname@domain`
       2. `firstname.m.lastname@domain`
       3. `firstname.lastname2@domain`
       4. Manual edit required (`needsManualReview: true`)
     - **Minor Naming Privacy (NDPA 2023 Sec. 31 / Children's Code)**: Generates initial handle (`f.lastname@domain`) when `isMinor && minorPrivacyRequested`.
     - **Mailbox Capability State Mapping**: Computes truthful capability state (`login_only`, `external_verified`, or `provider_provisioned`).
   - `assignInstitutionalMailbox`:
     - Assigns verified mailbox to person in `institutionalMailboxes`.
     - **Fault Isolation**: External provider API errors (e.g. HTTP 503) are safely isolated; internal person identity and branch memberships are NEVER corrupted or deleted.
   - `suspendOrArchiveMailbox`:
     - **Permanent Re-Allocation Freeze**: User departure marks mailbox `suspended` or `archived` without deleting the record; historical addresses are permanently frozen from future recycling.
   - Queries: `getSchoolEmailDomains`, `getInstitutionalMailboxes`.

3. **AI Import Review Pipeline Module (`packages/convex/functions/academic/aiImport.ts`)**:
   - **Zero Direct AI Commits Invariant (F3 / MX-11)**: All AI extractions stage into `aiImportWorkspaces` for operator review; the AI service has zero direct write capabilities to operational tables (`students`, `classes`, `users`).
   - `stageImportData`:
     - Strips passwords, secrets, JWTs, and bearer tokens from raw extraction rows prior to staging.
     - Performs deterministic schema validation (e.g. required first/last names, past DOB timestamp, batch & database admission number uniqueness, gender taxonomy).
     - Persists workspace with `status: "staged"` and flags row-level errors (`validationErrors: [{ rowIndex, field, message }]`).
   - `updateStagedRow`:
     - Allows human operator to correct cells in staged rows prior to commit.
     - Re-evaluates deterministic validation across all rows and updates workspace status to `"reviewed"`.
   - `commitImportWorkspace`:
     - Enforces human review status check (`staged` or `reviewed`).
     - **Pre-Commit Gate**: Strictly rejects committing if any unresolved validation errors remain.
     - Atomically commits validated rows into official operational tables (`students`, `classes`, `users`).
     - Transitions workspace status to `"committed"` and logs append-only audit record.
   - Queries: `getImportWorkspace`, `listImportWorkspaces`.

---

### 2. Verification & Test Evidence

1. **Convex Backend Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean, 0 errors).

2. **Integration Test Suite (`packages/convex/functions/academic/__tests__/emailAndAiImport.integration.test.ts`)**:
   - Command: `pnpm --filter @school/convex test emailAndAiImport.integration.test.ts`
   - Result: 6 tests passed in 183ms:
     1. Address proposal workbench generates deterministic handles and resolves collisions (`john.doe` -> `john.m.doe` -> `john.doe2`).
     2. Stage 4 manual edit required flagged when all deterministic stages collide.
     3. Minor naming privacy suppression produces masked/initial handle (`d.adeleke@cedarwood.edu.ng`) when requested.
     4. Domain registration and DNS TXT verification state transitions (`pending_verification` -> `verified` / `failed`).
     5. AI import pipeline:
        - Staging an extraction catches validation errors without committing to operational tables.
        - Committing with unresolved validation errors is strictly rejected.
        - Updating staged rows to fix errors, then committing, atomically creates operational records (`students`, `classes`, `users`) and updates workspace status to `committed`.
     6. External directory provider fault isolation: simulated provider error leaves internal person and branch membership records 100% intact, and address freeze blocks reassignment.

---

### 3. Merged Artifact Inventory

- `packages/convex/schema.ts` (added `schoolEmailDomains`, `institutionalMailboxes`, `aiImportWorkspaces` tables and indexes)
- `packages/convex/functions/academic/institutionalEmail.ts` (domain registration, DNS TXT verification, 4-stage collision resolution, minor naming privacy, fault-isolated assignment, freeze suspension)
- `packages/convex/functions/academic/aiImport.ts` (zero direct commits, credential stripping, deterministic validation, cell editing, atomic batch commit)
- `packages/convex/functions/academic/__tests__/emailAndAiImport.integration.test.ts` (comprehensive integration test suite)
