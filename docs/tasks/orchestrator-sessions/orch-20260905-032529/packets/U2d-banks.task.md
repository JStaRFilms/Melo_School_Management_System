# U2d — Bank settings and immutable financial instructions

## Objective / scope
Deliver authorized multiple/default bank settings and correct unpaid document instructions, preserving issued snapshots and omitting transfer instructions from receipts.

## Context / dependencies
U1a/U1b/U1e. Read H3 and actual bankAccounts.ts/billing issuance/Portal billing reader. `listBankAccounts` catches auth failure then returns masked metadata: fix before UI exposure. addBankAccount/setPrimaryBankAccount exist; edit/archive/full international fields are incomplete. `billing.ts` calls snapshotInvoicePaymentInstructionsHelper during issuance; getInvoicePaymentView/getInvoiceReceipt are unused and general membership is not sufficient Portal family authority.

## Ownership
U2d files in plan: bankAccounts.ts, billing.ts, relevant Portal billing query/render seam, Admin SettingsPanel/PrintableFinanceModal/types/hooks and bank panel. Domain billing changes finish before U3c/U5a. Schema updates serialized.

## Instructions
1. Fail closed for tenant-denied account reads. Use capability-gated authorized edit/full values and masked summaries; keep audit masked. Add edit/archive and required fields plus approved optional bank metadata; never hard-delete historical accounts. Ensure exactly valid active default when accounts exist.
2. Require confirmation for sensitive changes, statutory audit and leadership alert. Say Active/School-confirmed, never Verified absent provider evidence. Do not implement fake step-up verification.
3. Allow approved alternate account selection on fee/invoice creation. Snapshot chosen instructions in issue transaction, never via client follow-up. Issued values remain unchanged after account edits/archive.
4. Trace invoices, statements, reminders/downloads and unpaid Portal surfaces through real data contracts. Show full instructions only within authorized document scope; receipts and settled views omit. Historic issued record without snapshot shows unavailable instructions rather than current account substitution.

## Definition of done / verification
Bank and billing tests cover unauthorized metadata denial, default/archive, masked audit, alternate account issuance, post-edit immutability, legacy missing snapshot, paid/waived receipt behavior and unrelated Portal student denial. UI loading/empty/error/denied/confirm states; local typechecks/tests recorded. Use synthetic finance data only; no payment triggers.

## Execution status

Local bank settings, alternate fee-plan/invoice selection and immutable Admin/Portal document consumers implemented and verified; see `../results/U2d.md` for exact coverage and E0/U7 evidence requests. No live rollout or browser/print evidence claimed. U2c remains separately partial.

## Artifacts
`results/U2d.md`: invoice→document consumer manifest, exact APIs/security changes, tests/self-review and U7 print/Portal screenshots. Update matrix. No live bank/provider setup, production, migration, deployment, credential or unapproved CLI/PR operations.
