# Task B05 / M4: Grade Band, Sequential Admission Number, and Bank Account Verticals (H1/H4/H3) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M4 / PR-E  
**Authors**: Fullstack Domain Systems & Financial Engineer  

---

### 1. Architectural Summary & Scope

Task B-05 delivers the core branch customization verticals with strict snapshot immutability, atomic counters, step-up masking, and grayscale print legibility:

1. **Schema Additions (`packages/convex/schema.ts`)**:
   - `gradingBands`: Updated table with `colorHex`, `color`, `gradePoints`, `luminanceContrast`, `version`, indexed by `by_school` and `by_school_active`.
   - `admissionNumberPolicies`: Added table with token pattern, school/campus codes, atomic sequence counter, reset frequencies, indexed by `by_school`.
   - `schoolBankAccounts`: Added table for multi-account tuition collections with sortCode, transferNote, currency, default flag, and status, indexed by `by_school`, `by_school_and_status`, and `by_school_and_default`.
   - `studentInvoices.paymentInstructionsSnapshot`: Added optional immutable snapshot object storing bank account ID, bank name, account name, unmasked account number, sort code, currency, transfer note, and snapshot timestamp.

2. **Grade Bands Module (`packages/convex/functions/academic/gradingBands.ts`)**:
   - `FACTORY_DEFAULT_GRADING_BANDS`: Immutable preset standard with luminance-safe contrast (A: 75-100, B: 65-74, C: 50-64, D: 45-49, E: 40-44, F: 0-39).
   - `calculateRelativeLuminance` & `calculateContrastAgainstWhite`: Mathematical relative luminance per ITU-R BT.709 guaranteeing $L \ge 4.5:1$ against white paper.
   - `validateContiguousScoreRanges`: Asserts 0–100 coverage without gaps or overlapping ranges.
   - `getGradingBands`: Returns custom branch bands or factory standard defaults with luminance metrics.
   - `updateGradingBands`: Enforces `academic.grading.manage` capability, validates contiguous ranges, deactivates historical active bands, inserts new bands, and writes an append-only audit event.

3. **Sequential Admission Numbers Module (`packages/convex/functions/academic/admissionNumbers.ts`)**:
   - Token Support: `{SCHOOL}`, `{CAMPUS}`, `{LEVEL}`, `{YEAR}`, `{SEQ:n}`.
   - `formatAdmissionNumber`: Parses pattern expressions and formats padded identifiers.
   - `validatePattern`: Enforces `{SEQ:n}` token requirement and rejects unsupported expressions.
   - `getAdmissionNumberPolicy`: Returns active policy with dynamic live preview of the next formatted identifier.
   - `updateAdmissionNumberPolicy`: Validates tokens, updates pattern/codes, and logs audit events.
   - `allocateNextAdmissionNumberInternal`: Atomic transaction incrementing `currentSequence` without gaps or race conditions.

4. **Bank Accounts & Invoice Snapshots Module (`packages/convex/functions/academic/bankAccounts.ts`)**:
   - `maskAccountNumber`: Formats account numbers with step-up masking (`***-****-1234`).
   - `listBankAccounts`: Authorization-gated account query. Callers holding `finance.bank.manage` (or proprietor/admin) receive unmasked account numbers; unauthorized callers receive masked numbers.
   - `addBankAccount` & `setPrimaryBankAccount`: Manages accounts, clears previous defaults on primary assignment, and emits **Tier 1 Critical** audit alerts (`alertTier: "tier1_critical"`).
   - `snapshotInvoicePaymentInstructions`: Locks the default bank account details into `studentInvoices.paymentInstructionsSnapshot` at invoice issue time. Immutability guarantee: existing snapshots are never overwritten when school bank settings change.
   - `getInvoicePaymentView` & `getInvoiceReceipt`: Displays payment instructions for unpaid/issued invoices and strictly suppresses payment instructions on receipts and settled invoices to prevent duplicate wire transfers (D-04 §5.2.2).

5. **RBAC Integration (`packages/convex/functions/academic/rbac.ts`)**:
   - Added canonical aliases `"academic.grading.manage"` and `"finance.bank.manage"` to `CAPABILITY_CATALOG` and `normalizeCapability`.
   - Added `"finance.bank.manage"` to `SENSITIVE_CAPABILITIES`.

---

### 2. Verification & Test Results

1. **Convex Backend Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean, 0 errors).

2. **Dedicated Integration Test Suite (`packages/convex/functions/academic/__tests__/verticalsH1H4H3.integration.test.ts`)**:
   - Command: `pnpm --filter @school/convex test verticalsH1H4H3.integration.test.ts`
   - Result: 5 passed in 231ms.
     - `1. Grade band retrieval returns standard defaults when unconfigured, and custom configured bands once updated`: Verified default fallback (A: 75-100 through F: 0-39 with $L \ge 4.5$), rejection of non-contiguous ranges, and custom band update. (PASSED)
     - `2. Admission number allocation advances counter atomically and produces correct token substitution`: Verified dynamic preview, token substitution (`OBC-LAG-JSS1-2026-0001`), and consecutive counter advances without gaps. (PASSED)
     - `3. Bank account listing masks numbers for unauthorized users and shows full numbers for authorized users`: Verified step-up masking for unauthorized staff, unmasked display for authorized admins, and Tier 1 Critical alert logging. (PASSED)
     - `4. Issued invoice snapshot immutability: changing the default bank account afterwards does NOT modify the snapshot on existing issued invoices`: Verified issued invoice snapshot retains First Bank details after switching default account to GTBank, while new invoices snapshot the new GTBank account. (PASSED)
     - `5. Receipts do not display payment instructions`: Verified unpaid invoices show instructions while paid invoices and receipts omit payment instructions. (PASSED)

3. **Regression Suite**:
   - Command: `pnpm --filter @school/convex test rbacAudit.integration.test.ts groups.integration.test.ts identityTenancy.integration.test.ts billing.integration.test.ts`
   - Result: 4 test files passed, 20 tests passed (Clean).

---

### 3. Merged Artifact Inventory

- `packages/convex/schema.ts` (updated `gradingBands`, `studentInvoices`, added `admissionNumberPolicies`, `schoolBankAccounts`)
- `packages/convex/functions/academic/rbac.ts` (added capability normalizations)
- `packages/convex/functions/academic/gradingBands.ts` (defaults, luminance, validation, queries, mutations)
- `packages/convex/functions/academic/admissionNumbers.ts` (token builder, preview, atomic allocator)
- `packages/convex/functions/academic/bankAccounts.ts` (masking, step-up authorization, snapshots, receipt suppression)
- `packages/convex/functions/academic/__tests__/verticalsH1H4H3.integration.test.ts` (integration test suite)
