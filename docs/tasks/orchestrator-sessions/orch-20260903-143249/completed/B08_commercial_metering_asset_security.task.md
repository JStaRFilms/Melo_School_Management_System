# Task B08 / M7: Commercial Catalog, Usage Metering, and Asset Security (F7/H8/H9) - Execution Record

**Status**: COMPLETED  
**Date**: 2026-09-03  
**Parent Session**: `orch-20260903-143249`  
**Milestone**: M7 / PR-H  
**Authors**: Commercial Systems & Asset Security Engineer  

---

### 1. Architectural Summary & Scope

Task B-08 implements transparent commercial catalog management, double-entry settlement ledgers, deterministic usage quota metering, file security quarantine, a navigable Trash workspace, and verified pure-JS PDF structural compression:

1. **Convex Schema Expansion (`packages/convex/schema.ts`)**:
   - `subscriptionPlans`:
     - Fields: `code`, `name`, `description`, `perStudentFeeKobo`, `termSetupFeeKobo`, `currency`, `billingCadence`, `status`, `createdAt`, `updatedAt`.
     - Index: `by_code` on `["code"]`.
   - `schoolSubscriptions`:
     - Fields: `schoolId`, `planId`, `status`, `activeStudentCount`, `currentTermFeeKobo`, `setupFeePaid`, `paymentRoutingMode`, `subaccountId`, `lastBilledAt`, `nextBillingDate`, `createdAt`, `updatedAt`.
     - Index: `by_school` on `["schoolId"]`.
   - `settlementLedgers`:
     - Fields: `schoolId`, `transactionRef`, `routingMode`, `grossAmountKobo`, `paystackFeeKobo`, `platformFeeKobo`, `netPayoutKobo`, `currency`, `clearingCycle` ("NIBSS_T_PLUS_1"), `estimatedSettlementDate`, `settlementNotice`, `destinationAccount`, `status`, `metadata`, `createdAt`, `settledAt`.
     - Indexes: `by_school_and_ref` on `["schoolId", "transactionRef"]`, `by_school_and_status` on `["schoolId", "status"]`, `by_school` on `["schoolId"]`.
   - `paymentMandates`:
     - Fields: `schoolId`, `customerEmail`, `authorizationCode`, `last4`, `expMonth`, `expYear`, `cardBrand`, `bankName`, `consentGiven`, `consentTimestamp`, `consentIpHash`, `status`, `createdAt`, `updatedAt`.
     - Indexes: `by_school` on `["schoolId"]`, `by_school_and_email` on `["schoolId", "customerEmail"]`.
   - `usageMeterAllocations`:
     - Fields: `schoolId`, `meterType`, `allocatedUnits`, `consumedUnits`, `reservedUnits`, `warningThresholdPercent`, `criticalThresholdPercent`, `hardStopThresholdPercent`, `resetCadence`, `lastResetAt`, `updatedAt`.
     - Index: `by_school_and_meter` on `["schoolId", "meterType"]`.
   - `usageEvents`:
     - Fields: `schoolId`, `meterType`, `unitsDelta`, `reservationId`, `actorUserId`, `actorPersonId`, `operationName`, `description`, `timestamp`.
     - Indexes: `by_school_and_timestamp` on `["schoolId", "timestamp"]`, `by_school_and_meter` on `["schoolId", "meterType"]`.
   - `schoolAssets`:
     - Fields: `schoolId`, `storageId`, `fileName`, `mimeType`, `byteSize`, `sha256`, `category`, `scanStatus`, `threatName`, `scannedAt`, `isTrashed`, `trashedAt`, `trashedByUserId`, `purgeScheduledAt`, `rollbackStorageId`, `rollbackExpiryAt`, `pageCount`, `isOptimized`, `uploadedByUserId`, `createdAt`, `updatedAt`.
     - Indexes: `by_school_and_trashed` on `["schoolId", "isTrashed"]`, `by_school_and_scan` on `["schoolId", "scanStatus"]`, `by_purge_schedule` on `["isTrashed", "purgeScheduledAt"]`, `by_school` on `["schoolId"]`.
   - `assetRetentionHolds`:
     - Fields: `assetId`, `schoolId`, `holdReason`, `appliedByUserId`, `appliedAt`, `notes`.
     - Indexes: `by_asset` on `["assetId"]`, `by_school` on `["schoolId"]`.
   - `assetQuarantineLogs`:
     - Fields: `assetId`, `schoolId`, `scanResult`, `threatName`, `scannerEngine`, `scannedAt`, `metadata`.
     - Index: `by_asset` on `["assetId"]`.

2. **Commercial Catalog & Settlement Module (`packages/convex/functions/academic/commercial.ts`)**:
   - `seedCommercialCatalog`: Idempotently seeds Core/Basic subscription plan at ₦1,000 per student per term (100,000 kobo) plus ₦30,000 setup fee (3,000,000 kobo).
   - `calculateSettlementBreakdown`:
     - Mode A (Direct School Merchant): 100% direct parent payment to school corporate bank account. Melo platform fee is 0.
     - Mode B (Melo-Routed Split Subaccount): Itemizes gross payment, Paystack processing fee, platform surcharge fee, and net payout.
     - Enforces double-entry balance: `paystackFeeKobo + platformFeeKobo + netPayoutKobo === grossAmountKobo`.
   - `recordSettlementTransaction`:
     - Enforces truthful clearing disclosures (`clearingCycle: "NIBSS_T_PLUS_1"`). Universal next-day clearing claims are strictly prohibited under Central Bank of Nigeria and NIBSS operational regulations.
     - Appends immutable audit log.
   - Queries: `getSettlementLedger`, `getSettlementByRef`, `getSchoolSubscription`, `listSubscriptionPlans`.
   - Mutation: `createOrUpdateSchoolSubscription` calculates termly platform charges (`activeStudentCount * ₦1,000 + setupFee`).

3. **Deterministic Usage Metering Module (`packages/convex/functions/academic/metering.ts`)**:
   - Two-Phase Reservation Model:
     - `reserveUsageQuota`: Validates available quota (`allocated - consumed - reserved`). Returns `{ allowed: false, shortfall, thresholdAlert: "hard_stop" }` if quota is exceeded. Atomically increments `reservedUnits`.
     - Threshold Alerts: Emits notifications at 75% (`notice_75`), 90% (`warning_90`), and hard-stop at 100% (`hard_stop`).
   - `commitUsageQuota`: Commits in-flight reserved units, updates `consumedUnits`, decrements `reservedUnits`, and logs `usageEvents`.
   - **Privacy Invariant**: Zero raw prompt texts or document payloads are stored in billing tables (only pseudonymized accounting metadata).
   - `releaseUsageQuota`: Releases reserved units back to available pool on cancellation.
   - Queries: `getUsageStatus`, `listUsageEvents`.
   - Mutation: `allocateQuota` (prepaid pack or termly allowance allocation).

4. **Asset Security, Navigable Trash, and Pure-JS PDF Compression (`packages/convex/functions/academic/assets.ts`)**:
   - **Quarantine Invariant**: Uploads land in quarantine (`scanStatus: "quarantined"`).
   - `processAssetScanResult`: Updates status to `"clean"` or `"infected"`. If infected, locks file, records threat name, quarantine log, and dispatches Tier 1 security alert.
   - `getDownloadableAssetUrl`: Download gate strictly rejects unscanned or infected files, or files in the Trash workspace.
   - Navigable Trash Workspace (`/admin/assets/trash`):
     - `trashAsset`: Soft-deletes asset, sets `purgeScheduledAt: now + 30 days`.
     - `listTrashedAssets`: Returns trashed assets with 30-day countdown and retention hold status.
     - `restoreAsset`: Restores asset back to active library.
     - `applyRetentionHold` & `removeRetentionHold`: Manages statutory audit or legal holds.
     - `permanentPurgeAsset`: Validates `isTrashed: true` and verifies NO active retention holds exist before permanent destruction of storage files and database records.
   - **Pure-JS PDF Compression**:
     - Native C/C++ binaries (Ghostscript, QPDF, Poppler, ImageMagick) strictly barred from Convex runtime.
     - `verifyPdfCompressionCandidate`: Pure-JS `pdf-lib` verification ensuring:
       1. Exact page count preservation (`origDoc.getPageCount() === compDoc.getPageCount()`).
       2. >10% savings gate (`compressedBytes < 0.90 * originalBytes`).
     - `commitOptimizedPdfAsset`: Preserves original storage ID in `rollbackStorageId` with 14-day rollback window.
     - `rollbackOptimizedPdfAsset`: One-click rollback restores uncompressed original.

---

### 2. Verification & Test Evidence

1. **Convex Backend Typecheck**:
   - Command: `pnpm --filter @school/convex typecheck`
   - Result: `tsc --noEmit -p tsconfig.json` exited 0 (Clean, 0 errors).

2. **Integration Test Suite (`packages/convex/functions/academic/__tests__/commercialAndAssets.integration.test.ts`)**:
   - Command: `pnpm --filter @school/convex test commercialAndAssets.integration.test.ts`
   - Result: 8 tests passed in 145ms:
     1. Commercial catalog seeds ₦1,000/student/term + ₦30,000 setup fee and verifies idempotent seeding.
     2. School subscription term fees calculated correctly with setup fee inclusion/exclusion.
     3. Mode A 100% direct settlement vs Mode B split itemization with balanced ledgers verified.
     4. Truthful NIBSS T+1 interbank clearing cycle disclosure verified on settlement records.
     5. Usage metering quota reservation allows valid requests, triggers warning at 75% and 90%, and strictly blocks with `hard_stop` at 100% shortfall.
     6. Asset quarantine gate rejects downloading unscanned or infected assets and allows clean assets.
     7. Navigable Trash workspace sets 30-day purge schedule, restores assets, and blocks permanent purge when retention hold is active.
     8. Pure-JS PDF compression verification gate preserves exact page count and enforces >10% savings threshold using `pdf-lib`.

3. **Full Convex Regression Suite**:
   - Command: `pnpm --filter @school/convex test`
   - Result: 29 test files passed, 159 tests passed in 7.13s (0 failures).

---

### 3. Merged Artifact Inventory

- `packages/convex/schema.ts` (added 9 tables: `subscriptionPlans`, `schoolSubscriptions`, `settlementLedgers`, `paymentMandates`, `usageMeterAllocations`, `usageEvents`, `schoolAssets`, `assetRetentionHolds`, `assetQuarantineLogs` with all required indexes)
- `packages/convex/functions/academic/commercial.ts` (commercial catalog seeding, Mode A/B settlement math, NIBSS T+1 disclosure, subscription management)
- `packages/convex/functions/academic/metering.ts` (atomic quota reservation, threshold warnings at 75%/90%, hard-stop enforcement, pseudonymized usage accounting)
- `packages/convex/functions/academic/assets.ts` (quarantine gate, navigable trash workspace, 30-day countdown, retention hold locks, pure-JS PDF compression verification with rollback copy)
- `packages/convex/functions/academic/__tests__/commercialAndAssets.integration.test.ts` (comprehensive integration test suite)
