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
- school-configured selectable billing collections for books, uniforms, transport, and similar purchases
- Parent and Admin selection of optional rows on unpaid class-default invoices

It does **not** include platform SaaS subscription billing, inventory, stock, sizing, suppliers, returns, or fulfilment tracking.

### Selectable billing boundary

Selectable collections are catalogs, not receivables. Class targeting grants eligibility only. Listing or browsing a collection never creates an invoice or changes an outstanding balance.

A Parent or authorized Admin creates a collection invoice by submitting at least one active item with a positive integer quantity. The backend validates the current catalog, class eligibility, student enrollment, school, session, term, and settlement account in one transaction. It then writes one positive invoice containing only immutable snapshots of the committed items. Collection invoices cannot be edited through this feature after creation.

Class-default fee plans remain the source of compulsory charges. Plans using `optionalSelectionMode: "parent_selectable"` write optional rows as explicitly unselected while mandatory rows keep the invoice total positive. A Parent or authorized Admin may update those optional rows before the first payment. Each update requires the current selection revision and recalculates invoice totals, balance, status, and installments atomically. Any positive `amountPaid` or payment allocation locks the composition permanently.

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
6. Admin users can create selectable collections for one or more eligible classes. This catalog write creates no invoice.
7. An authorized Admin can issue selected collection items to one or several eligible active students. A linked Parent can browse eligible collections for an accessible active student and create the same positive snapshot invoice atomically.
8. Parent-selectable optional rows on class-default invoices can be revision-updated before payment. Legacy optional rows with missing `isSelected` remain included until an authorized user explicitly changes them.
9. Online payment initialization requires the current selection revision for invoices whose fee-plan optional rows remain mutable. The attempt-recording mutation reloads the invoice and rejects a changed revision or balance before the payment URL is returned.
10. Manual cash or bank payments can be recorded against an invoice and automatically update invoice balances.
11. Admins can configure school-level billing defaults, choose the active Paystack merchant mode, and enable or disable online payments for the school.
12. School admins can save and validate per-mode Paystack merchant credentials from the billing workspace without exposing raw secrets back to the normal UI.
13. Online payment initialization is provided through a provider adapter, the admin can generate a front-desk payment URL, and the default return target is an authenticated Paystack callback page inside the correct workspace.
14. Every generated online payment link now creates a durable payment-attempt record that preserves the active merchant mode alongside the reference so pending references can survive cross-device handoff gaps.
15. Paystack webhook callbacks now resolve the candidate school invoice context first and verify the signature with the correct school-specific merchant secret before mutating invoice state.
16. The admin billing workspace can passively recheck pending references and surface whether they are still pending, verified, webhook reconciled, or need manual attention.
17. Admins can filter collections by class, term, invoice status, or search text.
18. Admins can open a selected invoice in a printable finance pack, generate or reuse a Paystack-first payment URL, and print the invoice with the URL and QR code.
19. Admins can open a printable student statement from an invoice row showing charge lines, payment date/times, invoice references, and calculated charge/payment/balance totals.

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
- optional selection policy, with missing values preserving legacy included behavior

### `selectableBillingCollections`
- school-scoped catalog metadata, currency, optional settlement account, active state, and one or more eligible class ids
- contains no invoice total and creates no debt by itself

### `selectableBillingItems`
- bounded child rows for collection item name, description, unit amount, category, display order, and active state
- invoice creation copies immutable name, unit amount, quantity, and extended amount snapshots

### `feePlanApplications`
- auditable bulk application runs for class-default plans
- captures school, plan, class, session, term, and created/skipped counts

### `studentInvoices`
- school-scoped invoice records for one student, class, session, and term
- exactly one source for new writes: a fee plan or selectable collection
- fee-plan or collection-name snapshot and accounting totals
- collection request key and deterministic fingerprint for per-student idempotency
- optional selection revision for editable class-default invoices
- line-item quantity, unit amount, and source-item provenance snapshots
- balance, waiver, discount, and payment tracking fields

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

## Public backend contracts

Admin contracts in `functions.billing`:

- `listSelectableBillingCollections({ includeInactive? })`
- `createSelectableBillingCollection({ bankAccountId?, name, description?, currency?, targetClassIds, items })`
- `issueSelectableBillingItems({ requestKey, collectionId, studentIds, sessionId, termId, selections, bankAccountId?, dueDate?, notes? })`
- `updateInvoiceOptionalSelections({ invoiceId, expectedSelectionRevision, selections })`
- `initializeOnlinePayment(...)` with `expectedSelectionRevision?`

Parent contracts in `functions.portal`:

- `listEligibleSelectableBillingCollections({ studentId, sessionId, termId })`
- `createSelectableInvoice({ requestKey, studentId, collectionId, sessionId, termId, selections })`
- `updateInvoiceOptionalSelections({ invoiceId, expectedSelectionRevision, selections })`
- extended `getBillingData` optional-row, revision, and lock projections
- `functions.billing.initializePortalOnlinePayment(...)` with `expectedSelectionRevision?`

New collection creation paths return structured `ConvexError` data for inaccessible records, permission failures, validation, idempotency conflict, duplicate invoice, stale selection revision, payment/cancellation lock, and zero-value invoice rejection. School and Parent student access come from authenticated server-side membership. The new catalog and issuance contracts do not accept `schoolId`.

## Compatibility and migration

No historical invoice backfill is required or permitted for this feature. Existing fee plans with a missing optional selection mode use `legacy_included`. Existing optional invoice rows with missing `isSelected` remain included in reads and accounting. Existing invoice source fields become optional only to support collection invoices; all new invoice writes enforce exactly one source.

Deployment adds two tables and optional fields. Branch duplication remaps collection class, bank, user, and invoice source references. Tenant purge and demo seed cleanup delete item rows before collection rows. Nested invoice `sourceSelectableItemId` values are provenance snapshots and are not authoritative foreign keys.

## UX Direction

- Keep billing tasks compact and mobile-friendly for bursary staff.
- Show outstanding balance and collection status first.
- Make payment states obvious: manual, online, pending, verified, reconciled, unresolved.
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
