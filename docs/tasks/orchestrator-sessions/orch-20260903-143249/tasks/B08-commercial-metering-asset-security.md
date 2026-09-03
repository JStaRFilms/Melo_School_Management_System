# Task B-08 / M7: Commercial Catalog, Usage Metering, and Asset Security (F7/H8/H9)

## Objective
Deploy transparent monetization, deterministic usage metering, asset quarantine/security, navigable Trash workspace, and verified pure-JS PDF structural compression.

## Scope
- **Commercial Catalog & Settlement Ledger (F7 / MX-12)**:
  - Seed catalog: Core/Basic seeded at ₦1,000 per active student per term + ₦30,000 setup fee.
  - Paystack routing: Mode A (Direct School Merchant - 100% direct settlement) vs Mode B (Melo-Routed Split Subaccount).
  - Settlement transparency: Internal double-entry ledgering disclosing NIBSS T+1 clearing reality (no false next-day settlement promises).
  - Recurring tokenized mandates (`authorization_code`), customer consent flow, idempotency keys.
  - Schema additions in `packages/convex/schema.ts`: `subscriptionPlans`, `schoolSubscriptions`, `settlementLedgers`, `paymentMandates`.
- **Usage Metering & Threshold Protection (H8 / MX-13)**:
  - Reservation model: Pre-flight cost estimation & quota reservation before expensive operations (OCR, batch AI).
  - Schema additions: `usageMeterAllocations`, `usageEvents`.
  - Notifications at 75% and 90% utilization; hard-stop at 100% quota shortfall.
  - Pseudonymized usage accounting (zero raw document/prompt payloads in billing tables).
- **School Asset Security, Navigable Trash, and PDF Compression (H9 / MX-14)**:
  - Quarantine state machine: Uploads land in private quarantine bucket (`status: quarantined` -> `scanning` -> `clean` | `infected`).
  - Strict exclusion: Native C/C++ binaries (`ghostscript`, `qpdf`, `poppler`, `ImageMagick`) strictly barred; pure-JS `pdf-lib` only.
  - PDF compression verification gate: Must achieve >10% savings and verify exact page count preservation; original preserved for 14-day rollback.
  - Navigable Trash workspace (`/admin/assets/trash`): Soft-delete, 30-day countdown, restore, and `retentionHolds` lock.
  - Schema additions: `schoolAssets`, `assetQuarantineLogs`, `assetRetentionHolds`.
- **Integration Tests**:
  - Direct vs split mode settlement ledger math.
  - Usage metering quota reservation and threshold hard-stop.
  - Asset quarantine gate blocking download until clean.
  - Trash workspace inspection, restore, and retention hold blocking purge.
  - PDF compression eligibility gate (>10% savings check and page count validation).

## Definition of Done
- Direct merchant Mode A strictly isolated from Split Mode B.
- No false next-day settlement claims.
- Usage metering tracks and enforces quotas deterministically.
- Unscanned assets remain strictly in quarantine.
- Trash workspace is navigable with restore and retention holds.
- PDF compression verifies page counts and >10% savings with rollback copy.

## Dependencies
- B-03 (RBAC) and B-04 (Group/Branch) complete.
- D-01, D-03, D-04 frozen.
