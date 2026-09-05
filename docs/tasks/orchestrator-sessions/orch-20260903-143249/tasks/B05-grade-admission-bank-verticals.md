# Task B-05 / M4: Grade Band, Sequential Admission Number, and Bank Account Verticals (H1/H4/H3)

## Objective
Deliver the core branch customization verticals with strict snapshot immutability, atomic counters, and grayscale print legibility.

## Scope
- **Grade Band Configuration (H1 / MX-06)**:
  - Schema: `gradingBands` with configurable color hex, letter, min/max score, grade points, and print luminance contract.
  - Defaults preserved as immutable factory preset.
  - Grayscale contract (@media print): High luminance contrast guaranteeing legibility on black-and-white laser printers without depending on color.
- **Sequential Admission Number Builder & Atomic Allocator (H4 / MX-08)**:
  - Schema: `admissionNumberPolicies` with token template `{SCHOOL}`, `{CAMPUS}`, `{LEVEL}`, `{YEAR}`, `{SEQ:4}`.
  - Atomic counter allocator: Evaluated inside enrollment approval mutation so official numbers advance without gaps or race conditions.
  - Dynamic live preview helper returning next formatted identifier.
- **Bank Account Settings & Issued Invoice Snapshotting (H3 / MX-07)**:
  - Schema: `schoolBankAccounts` (bank name, account number, account name, sort code, isDefault).
  - Step-up masking: Account numbers masked to last 4 digits (`***-****-1234`) unless user holds `finance.bank.manage` capability.
  - Snapshot immutability: When an invoice is issued, payment instructions are snapshotted permanently into `studentInvoices.paymentInstructionsSnapshot`.
  - Future edits to bank settings apply only to draft/new invoices, never to already-issued invoices.
  - Receipts suppress payment instructions by default (since payment is already completed).
- **Integration Tests**:
  - Issued invoice immutability test (updating bank account does not modify issued invoice snapshot).
  - Atomic admission number generation under concurrent requests.
  - Bank masking and unmasking permission gate.
  - Receipt payment detail suppression.

## Definition of Done
- Issued invoices retain snapshot payment instructions.
- Admission counter allocates atomically on approval.
- Bank account numbers are masked in lists, unmasked only with permission.
- Receipts hide payment instructions.
- All integration tests pass.

## Dependencies
- B-03 (RBAC) and B-04 (Group/Branch) complete.
- D-04 visual contract frozen.
