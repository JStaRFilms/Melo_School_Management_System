# Billing and Payments Foundation

## Goal

Give the school admin workspace real school-fee billing data structures, invoice generation, manual payment capture, school-scoped Paystack setup, gateway webhook handling, and collections visibility so finance screens can be built on top of stable backend contracts.

## Scope Boundary

This feature is for **school billing only**:

- student fee plans
- student invoices
- manual school payment capture
- school-scoped Paystack setup and payment-link handoff
- online payment initialization and webhook verification
- admin collections visibility

It does **not** include platform SaaS subscription billing.

### Routing Model

The current implementation now uses a **per-school Paystack merchant** model:

- each school can store its own Paystack merchant credentials
- billing settings choose the active merchant mode (`test` or `live`)
- payment initialization resolves the secret by `schoolId` and active mode
- webhook verification resolves the candidate school invoice context first, then verifies with the correct school-specific secret
- school billing remains separate from any future platform SaaS billing flow

## Components

### Server
- `packages/convex/schema.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingGateway.ts`
- `packages/convex/functions/billingProviders.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingWebhooks.ts`
- `packages/convex/http.ts`

### Client
- `apps/admin/app/billing/page.tsx`
- `apps/admin/app/payments/paystack/return/page.tsx`
- `packages/shared/src/workspace-navigation.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`

## Data Flow

1. A school admin opens the billing workspace.
2. The dashboard query loads fee plans, invoices, payments, payment-attempt lifecycle rows, collections summaries, and recent gateway events for the current school.
3. The admin can create a fee plan with itemized charges, an installment policy, and optional class targeting.
4. The admin can bulk-apply a class-default fee plan to covered students for a selected session and term.
5. The admin can generate a student invoice from a fee plan for one-off or student-specific charges.
6. Manual cash or bank payments can be recorded against an invoice and automatically update invoice balances.
7. Admins can configure school-level billing defaults, choose the active Paystack merchant mode, and enable or disable online payments for the school.
8. School admins can save and validate per-mode Paystack merchant credentials from the billing workspace without exposing raw secrets back to the normal UI.
9. Online payment initialization is provided through a provider adapter, the admin can generate a front-desk payment URL, and the default return target is an authenticated Paystack callback page inside the correct workspace.
10. Every generated online payment link now creates a durable payment-attempt record that preserves the active merchant mode alongside the reference so pending references can survive cross-device handoff gaps.
11. Paystack webhook callbacks now resolve the candidate school invoice context first and verify the signature with the correct school-specific merchant secret before mutating invoice state.
12. The admin billing workspace can passively recheck pending references and surface whether they are still pending, verified, webhook reconciled, or need manual attention.
13. Admins can filter collections by class, term, invoice status, or search text.
14. Admins can open a selected invoice in a printable finance pack, generate or reuse a Paystack-first payment URL, and print the invoice with the URL and QR code.
15. Admins can open a printable student statement from an invoice row showing charge lines, payment date/times, invoice references, and calculated charge/payment/balance totals.
16. A billing manager can permanently delete a fee plan only when it has no application run and no generated invoice.
17. A billing manager can archive an active fee plan or restore an archived plan. Archived plans remain visible in the archive view but cannot issue invoices.
18. A billing manager who can also issue invoices can revoke invoices from a fee plan. The operation archives the plan, cancels only unpaid invoices, leaves paid and partly paid invoices unchanged, records a reason on each cancelled invoice, and writes an append-only finance audit event.

## Database Schema

### `schoolBillingSettings`
- school-scoped billing defaults
- invoice prefix
- default currency
- default due days
- preferred gateway provider
- active payment provider mode (`test` or `live`)
- manual/online enable flags
- school-specific Paystack handoff configuration for admin/front-desk use

### `feePlans`
- school-scoped fee plan template
- line-item snapshot with categories and ordering
- installment policy snapshot
- class-targeting mode for class defaults vs manual extras
- target class ids for class-default plans
- active or archived lifecycle state; archived plans retain historical invoice links and can be restored
- derived usage counts in the billing read contract so the client does not guess whether deletion or revocation is safe

### `feePlanApplications`
- auditable bulk application runs for class-default plans
- captures school, plan, class, session, term, and created/skipped counts

### `feePlanLifecycleRuns`
- temporary server-owned continuation state for bounded deletion and revocation scans
- binds progress to the school, plan, actor, operation, and stable confirmation inputs so clients cannot skip ledger history
- indexed by school and included in tenant, demo-school, and branch-split cleanup

### `studentInvoices`
- school-scoped invoice records for one student, class, session, and term
- fee-plan snapshot and totals
- balance, waiver, discount, and payment tracking fields
- optional revocation timestamp, actor, and reason on invoices cancelled through fee-plan revocation

### `billingPayments`
- captures manual and gateway-backed payments
- tracks applied and unapplied amounts
- stores reconciliation state

### `billingPaymentAttempts`
- durable online-payment attempt records for generated Paystack links
- tracks pending, verified, webhook-reconciled, and manual-attention lifecycle states
- stores callback, gateway-reference, and reconciliation timestamps for cross-device follow-up

### `paymentAllocations`
- links a payment to an invoice allocation
- preserves audit visibility for applied amounts

### `paymentGatewayEvents`
- records verified gateway webhook activity
- stores raw payloads and signature verification status
- preserves merchant mode context for school-specific reconciliation
+
+### `schoolPaymentProviders`
+- school-scoped, mode-aware provider metadata for dashboard state
+- stores masked key state, readiness, validation timestamps, and active/pending secret references
+
+### `schoolPaymentProviderSecrets`
+- encrypted secret storage for school-scoped provider credentials
+- keeps secret material separate from normal UI-facing provider metadata

## Authorization and lifecycle rules

- `finance.fee_plans.manage` authorizes fee-plan creation, private draft recovery, archive, restore, and deletion.
- Revocation requires both `finance.fee_plans.manage` and `finance.invoices.issue` because it changes invoice state as well as the plan.
- Convex checks authorization and school ownership on every lifecycle mutation. Hiding UI controls is not an authorization boundary.
- A fee plan is deletable only if no `feePlanApplications` or `studentInvoices` row references it.
- Revocation never deletes invoice, payment, allocation, attempt, or gateway history.
- An invoice with a positive paid amount, or a `paid`, `partially_paid`, or `waived` status, blocks cancellation of that invoice. Other unpaid invoices from the same plan may still be cancelled.
- Manual payments cannot be recorded against a cancelled invoice. A verified gateway payment that arrives after revocation is preserved as a successful but unapplied, flagged payment without changing the cancelled invoice balance.
- Bulk deletion and revocation read bounded invoice pages through server-owned continuation runs, so clients cannot transplant cursors to skip financial history.
- Cancelled invoice balances remain preserved on the invoice record but are excluded from active school and household outstanding totals.
- Lifecycle changes write permanent finance audit events with the actor, target plan, result, reason where applicable, and affected invoice count; empty scan pages do not create audit noise.

## UX Direction

- Keep billing tasks compact and mobile-friendly for bursary staff.
- Show outstanding balance and collection status first.
- Make payment states obvious: manual, online, pending, verified, reconciled, unresolved.
- Keep invoice creation close to fee-plan setup so a school can move from template to bill quickly.

## Regression Checks

- Fee plans can be created without crossing school boundaries.
- Unused fee plans can be deleted, while any plan with an application or invoice reference cannot be deleted.
- Archived fee plans cannot generate direct or bulk invoices and can be restored by an authorized billing manager.
- Bulk revocation cancels unpaid invoices, preserves paid and partly paid invoices, and records late verified gateway payments as flagged and unapplied.
- Invoice generation respects the school context and the selected student/class/session/term.
- Manual payments only update the invoice they are attached to.
- Gateway webhooks are rejected unless the signature verifies.
- Dashboard filters do not leak another school's finance data.
- Platform subscription billing remains out of scope.

## Implemented Outcome

- The school admin app now has a live `/billing` workspace.
- Fee plans, invoices, and payment rows are backed by real Convex tables.
- Invoice balance calculations, waivers, and installment schedules are generated in backend code.
- Manual payment capture updates invoice balances and allocation history.
- School billing settings can be configured from the admin workflow, including invoice prefix, currency, due days, active merchant mode, and online-payment toggles.
- The admin billing workspace now includes masked per-school Paystack merchant setup, save, and validation flows for both test and live modes.
- A front-desk Paystack handoff flow can generate and share an invoice payment URL for the selected school invoice.
- The payment-link action is school-scoped and now defaults to workspace-aware Paystack return pages so cross-device payments do not bounce users into the wrong workspace.
- Admin and portal return pages now verify Paystack references only inside authenticated school or portal context instead of exposing a public verification surface.
- Durable payment-attempt records now preserve generated references and provider-mode context so the admin workspace can continue reconciling skipped-return or cross-device payments in the background.
- Paystack webhook verification now resolves the expected school invoice context and verifies with the correct school-specific merchant secret instead of a single global secret.
- Duplicate-event deduplication and payment event persistence remain wired through a dedicated HTTP action as a background fallback.
- The billing dashboard now exposes payment-attempt lifecycle states and recheck controls without mixing school billing with future platform SaaS billing.
- A provider-agnostic gateway adapter exists for future payment providers.
- Class-default fee plans can now be bulk-applied to a class for a session/term with duplicate prevention and audit history.
- The shared workspace navigation now includes a Finance/Billing section for admin users.
- Admin invoice rows now expose printable Invoice and Statement actions. The printable invoice includes line items, adjustments, due/issued date-times, balance, and a payment URL/QR code when a Paystack-first payment link exists or is generated from the print surface.
- The printable statement is student-scoped from the selected invoice and totals charges, applied payments, and balances from the school-scoped invoice/payment rows already returned by the billing dashboard.
- Payment history surfaces date and time in the admin billing UI so bursary staff can reconcile manual and online collections against exact receipt timestamps.
