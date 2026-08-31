# Feature: Olive Blessed Academy Multi-Branch Tenant Migration (Fedrah & Ruga Split)

## 1. Goal & Context

Split the single pilot tenant **"Olive Blessed Hands Academy"** on the production Convex database into two completely autonomous, isolated school tenants:

1. **Fedrah Branch (`obhis-fedrah`)**:
   - **Full Name**: `Olive Blessed Crest Academy (Fedrah, Abuja)`
   - **Slug**: `obhis-fedrah`
   - **Scope**: Retains all 5 primary classes (`Primary 1 - Olive Treasure`, `Primary 2 - Olive Peak`, `Primary 3 - Olive Great`, `Primary 4 - Olive Vine`, `Primary 5 - Olive Gold`) with 36 active students.
   - **Lead Admin**: `obhischool@gmail.com`
   - **Secondary Admin**: `admin.fedrah@oliveblessed.com`

2. **Ruga Branch (`obhis-ruga`)**:
   - **Full Name**: `Olive Blessed Crest Academy (Ruga, Nasarawa)`
   - **Slug**: `obhis-ruga`
   - **Scope**: Retains exclusively the 2 Ruga classes (`Primary 4 - Olive Fountain`, `JSS 1 - Olive Blaze`) with 10 active students.
   - **Lead Admin**: `admin.ruga@oliveblessed.com`

3. **Platform Super Admin Protection (Critical Invariant)**:
   - **`johnoke2005@gmail.com`** is a **Platform Super Admin** (in `platformAdmins`), NOT just a school user.
   - **Rule**: NEVER delete `johnoke2005@gmail.com` from Better Auth or from `platformAdmins`.
   - **Action**: ONLY remove John's record from the school-scoped `users` table for Olive Blessed (`schoolId: "kd73q7dt28ph1bmqjm20tsw2ed83k6j3"`), revoking school-level membership while preserving 100% of platform super-admin access.

4. **Fresh Academic State**:
   - Complete wipe of all 17 Knowledge Hub / AI curriculum tables for both schools (277 legacy pilot rows).
   - Pruning 8 unassigned subjects and 8 unassigned teachers from Ruga.

---

## 2. Multi-Tenancy Isolation Invariants

Every operational step is validated against these mathematical invariants:

| Invariant | Description | Verification Check |
|---|---|---|
| **Partition Exclusivity** | No document in school A references school B entities (`schoolId` mismatch). | `runSplitIntegrityCheck` cross-FK scan |
| **Class Separation** | Fedrah contains 0 Ruga classes; Ruga contains 0 Fedrah classes. | Class name search in `classes` |
| **Dangling Reference Zero** | No student has null/dangling `classId` or `userId`. | Student traversal in `students` |
| **Auth Linkage** | Every school admin has an active Better Auth account with credential provider and matching Convex `users.authId`. | `getAuthenticatedSchoolMembership` succeeds |
| **Super Admin Preservation** | `johnoke2005@gmail.com` exists in Better Auth and `platformAdmins` with `isActive: true`. | `resolvePlatformAdmin` check |
| **Billing Boundary** | Ruga payment providers point only to Ruga payment provider secrets. | `schoolPaymentProviders` audit |

---

## 3. Production Migration Protocol (Strict Execution DAG)

```
[Phase 0: Pre-Flight & Snapshot]
              │
              ▼
[Phase 1: Code & Schema Deploy]
              │
              ▼
[Phase 2: Duplication Pipeline (51 Tables, 5 Tiers)]
              │
              ▼
[Phase 3: Class-by-Class Cascade Deletion]
              │
              ▼
[Phase 4: Curriculum & AI Wipe (17 Tables)]
              │
              ▼
[Phase 5: Prune Unused Subjects & Teachers]
              │
              ▼
[Phase 6: Auth Provisioning & Admin Reconciliation]
              │
              ▼
[Phase 7: Automated Integrity Gate (0 Anomalies)]
              │
              ▼
[Phase 8: Post-Migration Admin Smoke Test]
```

### Phase 0: Pre-Flight & Snapshot
1. Create timestamped production backup including file storage:
   ```bash
   npx convex export --prod --include-file-storage prod-snapshot-pre-migration-$(date +%Y%m%d%H%M%S).zip
   ```
2. Verify archive integrity:
   ```bash
   tar -tf <snapshot_file>.zip | grep users/documents.jsonl
   ```
   **Completion Criterion**: Snapshot exists, is >5MB, and contains all user and file storage assets.

### Phase 1: Code & Schema Deploy
1. Deploy `migrationState` schema and migration functions to production:
   ```bash
   pnpm convex deploy
   ```
   **Completion Criterion**: `pnpm convex deploy` returns exit code 0.

### Phase 2: Duplication Pipeline
1. Initialize split state on production:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:initBranchSplit
   ```
2. Run batched duplication loop across all 5 tiers (51 tables, batch size 50):
   ```bash
   node scripts/run-duplicate-loop.mjs --prod
   ```
   **Completion Criterion**: `migrationState` reports `status: "completed"`, `phase: "duplication_completed"`, and `tablesCompleted: 51`.

### Phase 3: Cascade Delete Wrong-Branch Data
1. Execute class-by-class cascade deletion on Ruga:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:cascadeDeleteWrongBranchData '{"schoolSlug":"obhis-ruga"}'
   ```
2. Execute class-by-class cascade deletion on Fedrah:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:cascadeDeleteWrongBranchData '{"schoolSlug":"obhis-fedrah"}'
   ```
   **Completion Criterion**: Both runs report `done: true` and `remainingClasses: 0`.

### Phase 4: Wipe Knowledge Hub & AI Curriculum
1. Execute wipe across all 17 AI tables for both schools:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:wipeKnowledgeHubAndAi
   ```
   **Completion Criterion**: Returned `deletedRows` is positive and subsequent query returns 0 rows.

### Phase 5: Prune Unused Subjects & Teachers
1. Prune unassigned subjects and teachers from Ruga:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:pruneSubjectsAndUsers
   ```
   **Completion Criterion**: Unassigned Ruga subjects and teachers deleted without affecting assigned staff.

### Phase 6: Auth Provisioning & Admin Reconciliation
1. Execute reconciliation with super-admin preservation:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2Action:reconcileAdminsAndCleanupAction '{"password":"TempAdminPass2026!"}'
   ```
   **Completion Criterion**:
   - `obhischool@gmail.com` linked to Fedrah with `isSchoolAdmin: true` and `schoolAdminLeadership`.
   - `admin.fedrah@oliveblessed.com` provisioned in Better Auth and linked to Fedrah.
   - `admin.ruga@oliveblessed.com` provisioned in Better Auth and linked to Ruga with `schoolAdminLeadership`.
   - `johnoke2005@gmail.com` removed from Fedrah school `users`, but **retained** in Better Auth and `platformAdmins`.
   - Ruga student auth IDs point to `student:<rugaId>:...`.
   - Ruga payment providers point to Ruga secret records.

### Phase 7: Automated Integrity Gate
1. Run automated split integrity verification:
   ```bash
   pnpm exec convex run --prod functions/academic/branchSplitV2:runSplitIntegrityCheck
   ```
   **Completion Criterion**:
   - `passed === true`
   - `anomalies === []`
   - Fedrah: 5 classes, 36 students, 18 subjects, 2 admins (`obhischool@gmail.com`, `admin.fedrah@oliveblessed.com`).
   - Ruga: 2 classes, 10 students, 20 subjects, 1 admin (`admin.ruga@oliveblessed.com`).

### Phase 8: Post-Migration Smoke Test
1. Super Admin login test at `http://localhost:3006/sign-in` (`johnoke2005@gmail.com` / `StrongTempPass123!`).
2. Fedrah Admin login test at `http://localhost:3002/sign-in` (`obhischool@gmail.com` / `TempAdminPass2026!`).
3. Ruga Admin login test at `http://localhost:3002/sign-in` (`admin.ruga@oliveblessed.com` / `TempAdminPass2026!`).
