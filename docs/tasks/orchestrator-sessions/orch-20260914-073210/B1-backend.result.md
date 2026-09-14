# B1 selectable billing backend result

## Status

Backend implementation and focused integration coverage are complete. Follow-up reviews found and B1 corrected three omissions: the Admin dashboard now includes authoritative optional-item lock state, branch duplication creates bank accounts before remapping fee-plan and selectable-collection bank references, and Admin selectable issuance validates student tenancy before request-key history. Convex codegen was attempted after dependency installation, but this worktree has no `CONVEX_DEPLOYMENT`, so the CLI refused to generate files. The package typecheck passes, the original 29-test focused suite passed, the dashboard follow-up suite passed 8 tests, and the R1 blocker follow-up suite passed 6 tests.

No Admin or Portal application UI was changed as part of B1 or its follow-up correction.

## Implemented contracts

### Admin

- `billing.listSelectableBillingCollections({ includeInactive?: boolean })`
  - Requires Admin role and either `finance.fee_plans.manage` or `finance.invoices.issue`.
  - Derives the school from authenticated membership.
  - Returns at most 100 school collections, ordered by name, with at most 100 child items per collection and resolved target class names.
- `billing.createSelectableBillingCollection({ bankAccountId?, name, description?, currency?, targetClassIds, items })`
  - Requires Admin role and `finance.fee_plans.manage`.
  - Requires 1 to 100 unique active same-school classes and 1 to 100 unique named positive-price items.
  - Validates an optional active same-school, same-currency bank account.
  - Creates the collection and child items in one transaction and returns the collection projection.
- `billing.issueSelectableBillingItems({ requestKey, collectionId, studentIds, sessionId, termId, selections, bankAccountId?, dueDate?, notes? })`
  - Requires Admin role and `finance.invoices.issue`.
  - Accepts 1 to 100 unique active students and 1 to 100 unique item selections. Quantity is an integer from 1 to 9999.
  - Validates all supplied student IDs as same-school before building request fingerprints or reading per-student invoice history, so inaccessible IDs return tenant-safe `NOT_FOUND` without a request-key signal.
  - Validates all new recipients, current classes, eligibility, collection/items, session/term relation, currency, bank account, and positive total before inserting.
  - After ownership validation, uses one request key with a per-student deterministic fingerprint. Same-key equivalent requests replay; changed fingerprints abort with `IDEMPOTENCY_CONFLICT`; different-key active duplicates are skipped.
  - Returns `{ createdInvoices, replayedInvoices, skippedExistingStudentIds }`.
- `billing.updateInvoiceOptionalSelections({ invoiceId, expectedSelectionRevision, selections })`
  - Requires Admin role, `finance.invoices.issue`, a same-school class-default fee-plan invoice, and its current revision.
  - Returns `{ invoice, changed }`.
- `billing.getBillingDashboard(...)`
  - Each returned `invoice` now includes authoritative `canEditOptionalItems` and `selectionLockReason` (`null`, `not_editable`, `payment_recorded`, or `cancelled`).
  - Mixed mandatory/optional fee-plan invoices, including compatible legacy invoices, are editable before a lock. Collection invoices and other invoice shapes without editable fee-plan choices return `not_editable`.
  - Any `paymentAllocations.by_invoice` row returns `payment_recorded`, even when the invoice has `amountPaid === 0` and the allocation applied zero.
- Compatibility `billing.toggleInvoiceOptionalLineItem(...)`
  - Retained for existing callers, but now delegates to the authoritative revision and payment-lock helper.
- `billing.createFeePlan(...)`
  - Adds `optionalSelectionMode?: "legacy_included" | "parent_selectable"`.
  - Missing mode preserves legacy inclusion. Parent-selectable mode is limited to class-default plans with a positive mandatory base and writes optional rows as explicit `isSelected: false`.
- `billing.initializeOnlinePayment(...)`
  - Adds `expectedSelectionRevision?: number`.
  - Requires the effective revision for fee-plan invoices with mandatory and optional rows.

### Parent Portal

- `portal.listEligibleSelectableBillingCollections({ studentId, sessionId, termId })`
  - Requires the authenticated membership associated with the accessible student to have role `parent`.
  - Requires active enrollment and a valid same-school session/term relation.
  - Returns only active collections targeted to the current class and active items. Catalog reads do not write invoices.
- `portal.createSelectableInvoice({ requestKey, studentId, collectionId, sessionId, termId, selections })`
  - Derives Parent, school, student access, and class server-side.
  - Checks idempotency before live catalog validation so a successful retry can replay after later catalog changes.
  - Creates no holding or zero-value row. One transaction writes a positive invoice containing only selected immutable item snapshots, one full-payment installment, invoice number, and payment-instruction snapshot.
  - Returns `{ invoice: PortalBillingInvoice, replayed }`.
- `portal.updateInvoiceOptionalSelections({ invoiceId, expectedSelectionRevision, selections })`
  - Requires linked Parent access to the invoice student and uses the same authoritative update helper as Admin.
  - Returns `{ invoice: PortalBillingInvoice, changed }`.
- `portal.getBillingData({ studentId? })`
  - Adds effective selection revision, editability, lock reason, optional/selected flags, and quantity/unit-amount projections.
  - Missing legacy `isSelected` projects as selected. Missing quantity projects as 1 and missing unit amount as the line amount. Reads do not patch historical data.
- `billing.initializePortalOnlinePayment({ invoiceId, callbackUrl?, expectedSelectionRevision? })`
  - Requires the effective revision for fee-plan invoices with mandatory and optional rows.

### Shared accounting and errors

- Optional selection updates reject stale revisions, duplicate/unknown/mandatory line IDs, cancellation, positive `amountPaid`, or any payment allocation, including reversed or zero-amount allocation history.
- A valid change recalculates subtotal, waiver, discount, total, balance, status, and installment amounts in one transaction. Existing installment IDs, labels, due dates, and paid flags are preserved. A no-op does not increment the revision.
- Collection invoices snapshot item label, source item ID, unit amount, quantity, extended amount, category, and order. They have exactly one collection source and no fee-plan source.
- The payment-attempt persistence mutation reloads the invoice and rejects a changed selection revision or balance before the provider URL can be returned.
- New contract errors use `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `DUPLICATE_INVOICE`, `SELECTION_CONFLICT`, `SELECTION_LOCKED`, and `ZERO_VALUE_INVOICE` data where applicable.

## Schema and lifecycle

Added:

- `selectableBillingCollections`
- `selectableBillingItems`
- `feePlans.optionalSelectionMode?`
- optional `studentInvoices.feePlanId`
- `studentInvoices.selectableCollectionId?`
- `studentInvoices.selectionRevision?`
- `studentInvoices.creationRequestKey?`
- `studentInvoices.creationRequestFingerprint?`
- invoice line `sourceSelectableItemId?`, `unitAmount?`, and `quantity?`

Branch duplication now copies school bank accounts before fee plans and selectable collections, then copies items before invoices. Fee-plan and collection `bankAccountId` values therefore resolve through the completed bank-account ID map instead of retaining a source-school reference. Collection, class, bank, user, and invoice source references are remapped. Nested line `sourceSelectableItemId` remains non-authoritative provenance, as specified by G1. Tenant purge and demo seed cleanup register item rows before collection rows.

No historical backfill is required. Existing missing `isSelected` values stay included, missing selection revisions have effective revision 0, and missing optional-selection mode means `legacy_included`.

## Files changed

- `docs/features/BillingAndPaymentsFoundation.md`
- `packages/convex/schema.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingSelectableShared.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/portal.ts`
- `packages/convex/functions/academic/portalIdentity.ts`
- `packages/convex/functions/academic/branchSplitV2.ts`
- `packages/convex/functions/academic/tenantPurgeManifest.ts`
- `packages/convex/functions/academic/seed.ts`
- `packages/convex/functions/billingSelectable.integration.test.ts`
- `packages/convex/functions/academic/__tests__/tenantPurge.integration.test.ts`
- `packages/convex/functions/academic/__tests__/branchSplitBilling.integration.test.ts`
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B1-backend.result.md`

## Tests added or updated

- Added `packages/convex/functions/billingSelectable.integration.test.ts` with five integration cases covering:
  - read-only catalog eligibility and Parent positive invoice creation
  - empty, invalid, excessive, fractional, and duplicate selections
  - immutable quantity/price/name snapshots and bank instructions
  - Parent and Admin idempotency and duplicate behavior, including valid same-key replay after ownership validation
  - tenant-safe rejection of a cross-school student whose private invoice history contains the supplied request key
  - Parent-role enforcement, wrong-class and cross-school failures
  - parent-selectable fee-plan defaults, revision updates, stale writes, installment recalculation, allocation locks, and payment-attempt revision checks
  - Admin dashboard projections for editable fee-plan invoices, fixed collection invoices, and allocation-only payment locks with `amountPaid === 0`
- Updated `packages/convex/functions/academic/__tests__/tenantPurge.integration.test.ts` to prove both new tables are purged for the target tenant.
- Added `packages/convex/functions/academic/__tests__/branchSplitBilling.integration.test.ts` to execute bank, fee-plan, and selectable-collection duplication and prove both duplicated billing sources reference the target-school bank account.

## Commands and results

- `pnpm install --frozen-lockfile`
  - Passed. Installed the lockfile-defined workspace dependencies. No lockfile change.
- `pnpm --filter @school/convex test -- functions/billing.integration.test.ts`
  - The package script forwarded an extra `--`, so Vitest ran the broad package suite and the process later exited with Windows status `3221225477`. The requested billing file itself passed. Replaced by the direct focused command below.
- `pnpm --filter @school/convex exec vitest run functions/billing.integration.test.ts functions/billingSelectable.integration.test.ts functions/academic/__tests__/tenantPurge.integration.test.ts functions/academic/__tests__/seedCleanup.integration.test.ts functions/academic/__tests__/migrationLifecycle.test.ts`
  - Passed: 5 files, 29 tests.
  - Existing migration lifecycle warnings about direct registered-function calls were printed; none came from the B1 files and all 17 lifecycle tests passed.
- Follow-up: `pnpm --filter @school/convex exec vitest run functions/billing.integration.test.ts functions/billingSelectable.integration.test.ts`
  - Passed: 2 files, 8 tests, including the Admin allocation-only lock projection.
- R1 follow-up: `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/branchSplitBilling.integration.test.ts functions/billingSelectable.integration.test.ts`
  - First run: the selectable suite passed 5 tests, but the new branch test could not resolve the Convex module because its nested test glob was not normalized. The test harness was corrected without changing production behavior.
  - Second run passed: 2 files, 6 tests.
- `pnpm --filter @school/convex typecheck`
  - Passed with no TypeScript errors after the original implementation and both follow-up corrections.
- `pnpm --filter @school/convex exec eslint functions/billingSelectableShared.ts functions/billingSelectable.integration.test.ts`
  - Passed with no output.
- `git diff --check`
  - Passed with no whitespace errors.
- `pnpm --filter @school/convex convex:codegen`
  - Blocked: `No CONVEX_DEPLOYMENT set, run npx convex dev to configure a Convex project`.
  - The same result occurs with `pnpm exec convex codegen --dry-run --typecheck disable`; codegen has no offline mode for an unconfigured worktree.

## Migration and handoff notes

- Before B2 or B3 consumes generated references in a configured workspace, run `pnpm --filter @school/convex convex:codegen` with the intended development deployment selected. Do not deploy as part of B1.
- No data backfill should run. Deploy the additive tables and optional fields, then let new writes use the explicit policies.
- B2 should use the Admin contracts above, including the dashboard's authoritative optional-item lock projection, and keep one request key stable for an unchanged retry.
- B3 should call the eligible-collection query only for Parent viewers, use authoritative mutation totals, pass the current revision into optional updates and payment initialization, and treat collection invoices as fixed snapshots.
- Existing Admin and Portal UI do not expose these operations yet. That work remains in B2 and B3.
