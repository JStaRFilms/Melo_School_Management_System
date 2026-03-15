# T38 Manual Payment Capture and Reconciliation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-functions` and `convex-security-check`.
- Do not use `context7`.

## Objective

Implement manual payment recording, allocation to invoice items, reconciliation controls, and audit-safe adjustment flows.

## Scope

Included: cash or bank entry, allocation records, reconciliation states, audit fields.  
Excluded: admin billing UI polish.

## Context

This task fulfills the manual-payment half of `FR-014`.

## Definition of Done

- Admins can record manual payments against invoices.
- Payment allocations affect balances correctly.
- Reconciliation and adjustment actions are auditable.

## Expected Artifacts

- manual payment and allocation backend logic
- shared reconciliation-related types

## Constraints

- Do not allow silent overwrites of received amounts.
- Preserve who recorded and reconciled each payment.

## Verification

- Manual payment scenarios update invoice balances correctly and leave an audit trail.

