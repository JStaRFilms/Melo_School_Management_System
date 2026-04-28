# Task 05: Billing Printable Finance Pack

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/features/BillingAndPaymentsFoundation.md`.
- Read `docs/features/Billing_Redesign.md`.
- Read `docs/features/BillingReferenceResolutionHardening.md`.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `convex-security-check`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`

## Objective

Give schools a clean way to view and print invoices and payment statements with payment links, QR codes, and payment date/time visibility.

## Scope

- Add invoice print/view surface for a selected student invoice.
- Include payment URL and QR code in UI and printed invoice.
- Add printable statement view showing charges, payments, dates/times, balance, and invoice references.
- Keep payment provider logic provider-agnostic and Paystack-first.
- Preserve manual and online payment reconciliation rules.

## Acceptance Criteria

- Admin can open and print a student invoice with QR/payment link.
- Admin can open and print a student statement.
- Payment date/time is visible in the billing UI.
- Statement totals match invoice/payment data.
- No cross-school billing data can appear.
- Billing docs are updated and verification is recorded.
