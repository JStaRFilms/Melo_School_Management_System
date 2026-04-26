# Billing Reference Resolution Hardening

## Goal

Fix two billing reconciliation bugs that can leave real payments unresolved or duplicated in production:

- remove the implicit 1000-row cap when Paystack reference context is resolved from `invoiceNumber`
- normalize payment references before duplicate lookup so logically identical references do not create duplicate `billingPayments` rows

## Scope Boundary

This change is limited to the existing school billing and Paystack reconciliation flow:

- Paystack return-page verification
- webhook reconciliation
- manual payment capture and duplicate protection

It does **not** introduce new billing features, schema migrations, or UI workflow changes.

## Components

### Server

- `packages/convex/functions/billingProviders.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/schema.ts` (reference only, expected to remain unchanged)

### Client

- no client code changes expected

## Data Flow

### Invoice-number fallback during Paystack context resolution

1. A return-page or webhook flow calls `resolveSchoolPaystackReferenceContextInternal`.
2. If no durable attempt row matches the reference and no `invoiceId` is supplied, the function may fall back to `invoiceNumber`.
3. The current implementation reads only the first 1000 `studentInvoices` rows, then scans that subset in memory.
4. The fix should instead resolve the invoice through an indexed lookup so any valid invoice can be found regardless of table size.
5. Once the invoice is resolved, the school billing settings can still determine the correct Paystack mode for verification.

### Duplicate payment detection by reference

1. Manual or gateway-backed payment creation calls `createPaymentAndAllocation`.
2. The current duplicate lookup passes the raw `reference` into `loadPaymentByReference`.
3. New payment records are inserted with `normalizeBillingReference(args.reference)`.
4. A raw reference such as `" ABC123 "` can therefore bypass duplicate detection and later be stored as `"ABC123"`.
5. The fix should normalize the lookup input before querying so duplicate prevention uses the same canonical value as persistence.

## Database Schema

### Existing Tables

#### `studentInvoices`

- already has `by_school_and_number` on `["schoolId", "invoiceNumber"]`
- this index should be used for invoice-number-based resolution instead of scanning a bounded page

#### `billingPayments`

- already has `by_reference` on `["reference"]`
- duplicate detection should query this table using the normalized reference format already used for inserts

#### `billingPaymentAttempts`

- continues to be the primary trusted reference-resolution source before invoice fallback logic runs

## Implementation Plan

1. Update `resolveSchoolPaystackReferenceContextInternal` to replace the `.take(1000)` fallback with an indexed lookup path that does not silently miss invoices after the first page.
2. Update payment duplicate lookup so `loadPaymentByReference` uses the normalized billing reference value before querying.
3. Add or update focused tests if billing reconciliation tests already exist nearby; otherwise run targeted verification commands and document the gap.
4. Update this feature doc with the final implemented outcome and regression notes after the code lands.

## Regression Checks

- Paystack return-page verification still resolves invoices correctly when a durable payment-attempt row exists.
- Invoice-number fallback continues to work once `studentInvoices` grows beyond 1000 rows.
- Duplicate payment references differing only by whitespace or case normalization are rejected consistently.
- Existing school scoping on payment lookup remains intact.
- No schema migration is required for the fix.
