# Task B09 / M8: Within-Group Transfer Foundation and Final Verification (F4/MX-15) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M8 / PR-I  
**Authors**: Fullstack Builder & Verification Lead  

---

### 1. Architectural Summary & Scope

Task B-09 implements the foundational within-group branch-to-branch student transfer workflows with strict two-phase authorization, privacy preservation, and complete repository-wide verification:

1. **Convex Schema Expansion (`packages/convex/schema.ts`)**:
   - `studentTransfers`:
     - Fields: `groupId`, `sourceSchoolId`, `destinationSchoolId`, `studentId`, `studentName`, `guardianConsentRecorded`, `guardianConsentMethod`, `status` ("initiated" | "source_released" | "completed" | "cancelled" | "rejected"), `sourceReleaseNote`, `sourceReleasedByUserId`, `sourceReleasedAt`, `destinationClassId`, `destinationAdmissionNumber`, `destinationAcceptedByUserId`, `destinationAcceptedAt`, `portableRecordPackage` (`studentName`, `dateOfBirth`, `gender`, `academicHistorySummary`, `attendanceSummaryPct`, `medicalNotes`), `cancellationReason`, `createdAt`, `updatedAt`.
     - Indexes:
       - `by_group_and_status` on `["groupId", "status"]`
       - `by_source_school` on `["sourceSchoolId"]`
       - `by_destination_school` on `["destinationSchoolId"]`
       - `by_student` on `["studentId"]`

2. **Within-Group Student Transfer State Machine (`packages/convex/functions/academic/transfers.ts`)**:
   - **Strict Group Boundary Enforcement (F4 / MX-15)**:
     - Inter-branch transfers are permitted ONLY between schools belonging to the same active, verified `schoolGroup` (verified via `schoolGroupBranches`).
     - Cross-group or independent inter-school transfers are strictly rejected with:  
       `ConvexError("Cross-group transfers are not permitted. Transferee schools must belong to the same verified school group.")`.
     - Independent Melo-to-Melo transfer network remains gated for Phase 2 / M9 pending counsel review.
   - **Two-Phase Commit Handshake**:
     - `initiateStudentTransfer`:
       - Requires caller authority in source branch (`enrollment.intakes.manage`, admin, or proprietor).
       - Enforces affirmative recording of guardian consent (`guardianConsentRecorded: true` and non-empty `guardianConsentMethod`).
       - Validates student is currently active in source school and has no concurrent active transfer.
       - Compiles `portableRecordPackage` preserving academic and health essentials while strictly barring confidential records.
       - Creates transfer in status `"initiated"` and records immutable audit event.
     - `authorizeSourceRelease`:
       - Enforces source branch authority.
       - Validates status is `"initiated"`.
       - Transitions transfer to `"source_released"` with optional release notes, sign-off user ID, and timestamp.
       - Records audit event.
     - `acceptDestinationTransfer`:
       - Two-phase commit hard gate: strictly requires status `"source_released"`.
       - Enforces destination branch authority.
       - Verifies `destinationClassId` exists in destination branch.
       - Allocates next sequential admission number in destination branch using active destination policy (`allocateNextAdmissionNumberHelper`).
       - Re-assigns student record to destination branch (`schoolId`, `classId`, `admissionNumber`, `enrollmentStatus: "active"`).
       - Transitions status to `"completed"` with accepted user ID and timestamp.
       - Records audit event at destination branch.
     - `rejectOrCancelTransfer`:
       - Bilateral abort protocol: allows source branch to cancel (status: `"cancelled"`) or destination branch to decline (status: `"rejected"`) with mandatory reason.
       - Rejection or cancellation ensures student retains active enrollment in source branch.
       - Logs audit event.
   - **Supporting Queries**:
     - `getTransfer`: Fetch transfer details by ID.
     - `listTransfersBySchool`: Filter transfers by school branch, direction (source/destination/all), and status.
     - `listTransfersByGroup`: Filter transfers by group and status.
     - `getStudentTransferHistory`: Retrieve chronological transfer log for a student.

3. **Atomic Admission Counter Reuse (`packages/convex/functions/academic/admissionNumbers.ts`)**:
   - Extracted `allocateNextAdmissionNumberHelper` to enable direct in-transaction invocation from `acceptDestinationTransfer` without inter-function mutation calling warnings.

4. **Absolute Privacy Boundary & Selective Disclosure (D-01 §5 / D-03 §6.6)**:
   - In accordance with Nigeria Data Protection Act (NDPA) and minor safeguarding principles:
     - **Family Financial Debts & Invoices**: Unpaid tuition, invoice arrears, and fee disputes are PERMANENTLY EXCLUDED from the portable transfer record.
     - **Safeguarding & Pastoral Welfare**: Confidential child protection flags and social services referrals belong solely to the source branch DSL and statutory authorities; strictly excluded.
     - **Disciplinary Incidents**: Internal infractions and detention records are non-portable; strictly excluded.
     - Only verified academic progress, class enrollment, attendance percentage, and critical medical notes are bundled into `portableRecordPackage`.

5. **Historical Immutability & Referential Integrity (MX-15 §4)**:
   - Source branch historical attendance, examination scores, and billing invoices remain strictly tagged with `sourceSchoolId`.
   - No historical rows are rewritten in place.

---

### 2. Verification & Test Evidence

1. **TypeScript Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean, 0 errors across entire workspace).

2. **Focused Integration Test Suite (`packages/convex/functions/academic/__tests__/transfers.integration.test.ts`)**:
   - Command: `pnpm --filter @school/convex test transfers.integration.test.ts`
   - Result: 5 tests passed in 174ms:
     1. Positive: Two-phase commit (Initiate -> Release -> Accept) cleanly transfers student to destination branch, assigns class & admission number, preserving historical source tenancy.
     2. Negative: Attempting transfer between schools in different groups is strictly rejected (Cross-Group Gate).
     3. Negative: Attempting to accept before source release is rejected (Two-Phase Commit Gate).
     4. Privacy verification: Sensitive safeguarding notes, disciplinary incidents, and parent debt balances are strictly omitted from portable transfer record.
     5. Additional Gates: Guardian consent requirement and transfer cancellation/rejection lifecycle.

3. **Full Convex Backend Test Suite Regression Pass**:
   - Command: `pnpm --filter @school/convex test`
   - Result: **30 test files passed (100%), 164 tests passed (100%)** in 6.96s.
     - `transfers.integration.test.ts` (5 tests)
     - `commercialAndAssets.integration.test.ts` (8 tests)
     - `emailAndAiImport.integration.test.ts` (7 tests)
     - `drafts.integration.test.ts` (7 tests)
     - `verticalsH1H4H3.integration.test.ts` (8 tests)
     - `groups.integration.test.ts` (4 tests)
     - `rbacAudit.integration.test.ts` (8 tests)
     - `identityTenancy.integration.test.ts` (7 tests)
     - All prior academic, migration, admissions, and foundation tests passing cleanly.

---

### 3. Deliverables & Modified Files

- `packages/convex/schema.ts`: Added `studentTransfers` table definition with 4 indexes (`by_group_and_status`, `by_source_school`, `by_destination_school`, `by_student`).
- `packages/convex/functions/academic/admissionNumbers.ts`: Exported `allocateNextAdmissionNumberHelper` for atomic in-mutation counter allocation.
- `packages/convex/functions/academic/transfers.ts`: Implemented within-group transfer state machine (`initiateStudentTransfer`, `authorizeSourceRelease`, `acceptDestinationTransfer`, `rejectOrCancelTransfer`, plus inspection queries).
- `packages/convex/functions/academic/__tests__/transfers.integration.test.ts`: Added comprehensive integration tests covering two-phase commit, cross-group rejection, state gates, privacy boundaries, and immutability checks.
- `docs/tasks/orchestrator-sessions/orch-20260903-143249/completed/B09_within_group_transfers_final_verification.task.md`: Comprehensive completion execution record.
