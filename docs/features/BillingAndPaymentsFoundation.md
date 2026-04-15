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

The current MVP uses a constrained **direct-to-school** Paystack model:

- school metadata and invoice numbers are embedded in the checkout metadata
- the Paystack secret stays deployment-scoped
- webhook reconciliation resolves the invoice back to the originating school
- school billing remains separate from any future platform SaaS billing flow

## Components

### Server
- `packages/convex/schema.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingGateway.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingWebhooks.ts`
- `packages/convex/http.ts`

### Client
- `apps/admin/app/billing/page.tsx`
- `packages/shared/src/workspace-navigation.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`

## Data Flow

1. A school admin opens the billing workspace.
2. The dashboard query loads fee plans, invoices, payments, collections summaries, and recent gateway events for the current school.
3. The admin can create a fee plan with itemized charges, an installment policy, and optional class targeting.
4. The admin can bulk-apply a class-default fee plan to covered students for a selected session and term.
5. The admin can generate a student invoice from a fee plan for one-off or student-specific charges.
6. Manual cash or bank payments can be recorded against an invoice and automatically update invoice balances.
7. Admins can configure school-level billing defaults and enable or disable online Paystack payments for the school.
8. Online payment initialization is provided through a provider adapter, the admin can generate a front-desk payment URL, and Paystack webhook callbacks are signature-verified before they mutate invoice state.
9. Admins can filter collections by class, term, invoice status, or search text.

## Database Schema

### `schoolBillingSettings`
- school-scoped billing defaults
- invoice prefix
- default currency
- default due days
- preferred gateway provider
- manual/online enable flags
- direct-to-school Paystack handoff configuration for admin/front-desk use

### `feePlans`
- school-scoped fee plan template
- line-item snapshot with categories and ordering
- installment policy snapshot
- class-targeting mode for class defaults vs manual extras
- target class ids for class-default plans

### `feePlanApplications`
- auditable bulk application runs for class-default plans
- captures school, plan, class, session, term, and created/skipped counts

### `studentInvoices`
- school-scoped invoice records for one student, class, session, and term
- fee-plan snapshot and totals
- balance, waiver, discount, and payment tracking fields

### `billingPayments`
- captures manual and gateway-backed payments
- tracks applied and unapplied amounts
- stores reconciliation state

### `paymentAllocations`
- links a payment to an invoice allocation
- preserves audit visibility for applied amounts

### `paymentGatewayEvents`
- records verified gateway webhook activity
- stores raw payloads and signature verification status

## UX Direction

- Keep billing tasks compact and mobile-friendly for bursary staff.
- Show outstanding balance and collection status first.
- Make payment states obvious: manual, online, reconciled, unresolved.
- Keep invoice creation close to fee-plan setup so a school can move from template to bill quickly.

## Regression Checks

- Fee plans can be created without crossing school boundaries.
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
- School billing settings can be configured from the admin workflow, including invoice prefix, currency, due days, and online-payment toggles.
- A front-desk Paystack handoff flow can generate and share an invoice payment URL for the selected school invoice.
- The payment-link action is school-scoped and uses direct-to-school metadata routing so webhook reconciliation returns to the correct invoice.
- Paystack webhook verification, duplicate-event deduplication, and payment event persistence are wired through a dedicated HTTP action.
- A provider-agnostic gateway adapter exists for future payment providers.
- Class-default fee plans can now be bulk-applied to a class for a session/term with duplicate prevention and audit history.
- The shared workspace navigation now includes a Finance/Billing section for admin users.
