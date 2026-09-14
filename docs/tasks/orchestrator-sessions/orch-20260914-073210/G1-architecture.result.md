# G1 selectable billing architecture result

## Corrected decision

Keep dedicated `selectableBillingCollections` and `selectableBillingItems` tables. Do not use a zero-value invoice as a catalog or choice container.

Eligible collections belong in a separate read model. A parent first reads collections available to an accessible student, then submits at least one item and quantity. One mutation validates the live catalog and creates a positive invoice from immutable snapshots. Admin issuance follows the same rule.

`studentInvoices` remains the accounting record. It is created only when a charge has been chosen. Existing class-default invoices may still offer optional fee-plan rows because mandatory rows already make those invoices meaningful. Those optional rows can start unselected and can be revision-updated before payment.

## Current findings

### High severity

1. `packages/convex/functions/billingShared.ts:351-358` treats an optional row as selected unless `isSelected === false`. `normalizeBillingLineItems` at `packages/convex/functions/billingShared.ts:467-489` writes `isOptional` but not `isSelected`. Changing this fallback globally would silently reduce old balances.
2. `packages/convex/functions/billing.ts:2652-2717` has only an Admin optional-row toggle. It permits changes after a partial payment because it checks only `paid` and `cancelled` status. It does not check `amountPaid`, `paymentAllocations`, a revision, or refresh `installmentSchedule`.
3. `packages/convex/functions/portal.ts:52-91` omits `isOptional` and `isSelected` from portal results. `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:801-813` renders every row as a committed charge. No eligible-collection query, Parent invoice-creation mutation, or Parent optional-row mutation exists.
4. The prior G1 result proposed creating a zero-value invoice before the parent chose anything. That conflicts with the confirmed accounting rule. Eligibility is not a receivable and must not create an invoice.

### Medium severity

1. `createInvoiceFromFeePlan` exists at `packages/convex/functions/billing.ts:1675`, and `apps/admin/app/billing/hooks/useBillingActions.ts:10` binds it. The Admin UI cannot reach it. `apps/admin/app/billing/page.tsx:155` creates an immutable `invoiceDraft`, has no invoice submit handler, and `BillingSidebar.tsx` never renders its `invoice` variant.
2. `packages/convex/functions/billing.ts:411-504` has the right snapshot boundary for fee plans, but it copies optional rows without an explicit new-plan selection policy.
3. Admin summaries in `summarizeBillingCollections`, portal summaries in `portal.getBillingData`, group finance metrics in `packages/convex/functions/academic/groupOverview.ts:315-365`, and payment links all trust persisted invoice totals. This is useful. Correct mutations only need to maintain those stored totals atomically.
4. `packages/convex/functions/billing.integration.test.ts` covers fee-plan targeting, invoice issuance, bank snapshots, and dashboard event filtering. It has no coverage for selectable catalogs, idempotent issuance, optional-row revisions, or Parent authorization. The Portal package has no tests.

## Model comparison

### Extend `feePlans`

Adding a third billing mode looks smaller, but it mixes two incompatible concepts. Fee-plan class targeting currently feeds invoice issuance, while collection class targeting grants eligibility only. The current optional-row fallback also starts missing `isSelected` as included. Reusing this path would make deployment behavior hard to reason about.

### Dedicated collection tables

Dedicated tables keep catalog eligibility outside the ledger. They let both Admin and Parent create a positive invoice in one transaction after choosing items. Invoice snapshots still reuse the established billing, payment, print, and dashboard paths.

Recommendation: dedicated tables. The extra tables are a smaller risk than adding conditionals to every fee-plan path.

## Exact schema recommendation

### `selectableBillingCollections`

Add to `packages/convex/schema.ts`:

```ts
{
  schoolId: Id<"schools">;
  bankAccountId?: Id<"schoolBankAccounts">;
  name: string;
  description?: string;
  currency: string;
  targetClassIds: Id<"classes">[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: Id<"users">;
  updatedBy: Id<"users">;
}
```

Indexes:

- `by_school` on `schoolId`
- `by_school_and_isActive` on `schoolId, isActive`
- `by_school_and_bankAccountId` on `schoolId, bankAccountId`

New collections require at least one target class. Empty must not mean universal eligibility.

### `selectableBillingItems`

Add to `packages/convex/schema.ts`:

```ts
{
  schoolId: Id<"schools">;
  collectionId: Id<"selectableBillingCollections">;
  label: string;
  description?: string;
  unitAmount: number;
  category: BillingLineItemCategory;
  order: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: Id<"users">;
  updatedBy: Id<"users">;
}
```

Indexes:

- `by_school` on `schoolId`
- `by_collection` on `collectionId`
- `by_collection_and_isActive` on `collectionId, isActive`

Items should be child rows, not an unbounded array on the collection. Collection creation can still insert the collection and its initial items in one mutation.

### Compatible `feePlans` addition

Add an optional plan field:

```ts
optionalSelectionMode?: "legacy_included" | "parent_selectable";
```

Compatibility meaning:

- missing or `legacy_included`: preserve the current behavior when issuing. Optional rows with missing `isSelected` remain included.
- `parent_selectable`: invoice issuance writes each optional row with `isSelected: false` and each mandatory row with `isSelected: true` or no optional flag.

`createFeePlan` should accept this optional argument and default it to `legacy_included` for API compatibility. The updated Admin form sends `parent_selectable` when the operator adds optional rows. That mode is valid only for `class_default` plans with at least one positive mandatory row.

### Compatible `studentInvoices` additions

Change stored `feePlanId` from required to optional and add:

```ts
selectableCollectionId?: Id<"selectableBillingCollections">;
selectionRevision?: number;
creationRequestKey?: string;
creationRequestFingerprint?: string;
```

Mutation invariants:

- fee-plan invoice: `feePlanId` exists and `selectableCollectionId` does not
- collection invoice: `selectableCollectionId` exists and `feePlanId` does not
- no new invoice may have both source IDs or neither source ID
- `creationRequestKey` and fingerprint are written only by collection issuance
- new class-default invoices with parent-selectable optional rows write `selectionRevision: 0`
- legacy fee-plan invoices may omit the revision; the API projects missing as revision `0`
- collection invoices do not need a selection revision because the chosen composition is committed by the create mutation

Return validators expose nullable source IDs and a nullable stored revision. Portal projections may expose effective revision `0` for editable legacy rows.

Extend invoice line items and the shared return validator with optional snapshot fields:

```ts
sourceSelectableItemId?: Id<"selectableBillingItems">;
unitAmount?: number;
quantity?: number;
```

A collection invoice contains only chosen rows. Each row is written as:

```ts
{
  id: stableInvoiceLineId,
  label: sourceItem.label,
  amount: round(sourceItem.unitAmount * quantity),
  category: sourceItem.category,
  order: sourceItem.order,
  isOptional: true,
  isSelected: true,
  sourceSelectableItemId: sourceItem._id,
  unitAmount: sourceItem.unitAmount,
  quantity,
}
```

The mutation snapshots `label`, `unitAmount`, `quantity`, and extended `amount`. Later catalog edits or archival cannot change the invoice. Use the collection name as `feePlanNameSnapshot` for compatibility with current invoice displays.

Every collection invoice starts with:

- at least one line
- `subtotal > 0`
- `totalAmount > 0`
- `balanceDue === totalAmount`
- `amountPaid === 0`
- normal `issued` or `overdue` status
- one full-payment installment whose amount equals `totalAmount` and due date equals the invoice due date

The existing bank-instruction snapshot helper can run unchanged because the invoice is payable when created.

### Idempotency fields

Do not add another request table. Collection issuance is bounded by student, so use `studentInvoices.by_student` to find a matching `creationRequestKey` before insertion. Cap the scan and fail with a review-required error if a student's invoice history exceeds that bound.

Normalize selected rows by item ID before calculating a deterministic fingerprint over:

```ts
{
  actorKind: "parent" | "admin";
  actorUserId;
  schoolId;
  studentId;
  collectionId;
  sessionId;
  termId;
  requestedDueDate: number | null;
  selections: Array<{ itemId; quantity }>;
}
```

Fingerprint the requested due date or `null`, not a clock-derived default, so a retry remains stable. Check for a matching request key before deriving a new issue or due timestamp.

For Admin multi-student issuance, use the same client `requestKey` on each recipient invoice. Uniqueness is per student. A retry can therefore replay every recipient independently inside the same mutation.

## Legacy and fee-plan optional-row compatibility

The shared inclusion rule remains:

- mandatory row: included
- optional row with `isSelected: false`: excluded
- optional row with `isSelected: true` or missing: included

Deployment must not backfill or recompute old invoices. Missing `isSelected` stays selected in both calculations and read projections.

New `parent_selectable` class-default invoices differ deliberately:

1. Mandatory rows are included.
2. Optional rows are snapshotted with explicit `false`.
3. The mandatory subtotal, after invoice waiver and discount, must remain positive. Reject issuance if optional rows would be the only reason to retain a zero-value invoice.
4. The initial total and installment schedule use mandatory rows only.
5. Parent and authorized Admin users may revision-update only the optional rows before payment.

Legacy class-default invoices can use the same revision mutation if they contain at least one mandatory row and at least one optional row. Effective revision starts at `invoice.selectionRevision ?? 0`. A user action may then convert missing legacy values into explicit booleans. This is an intentional update, not a deployment migration.

Optional-only legacy invoices are read-only in Parent Portal. The compatibility Admin toggle may remain for controlled repair, but it must use the payment lock and must not create a zero-value invoice.

Keep the optional controls in the fee-plan form, but explain that these rows start unselected only when the plan uses the new parent-selectable policy. Remove copy that presents the total of all optional rows as the amount initially billed.

## Atomic calculation and payment lock

Use one shared mutation helper for Admin and Parent updates to optional rows on class-default invoices.

In one Convex transaction, the helper must:

1. Read the invoice and its fee plan.
2. Confirm the wrapper authorized this exact invoice.
3. Require at least one mandatory row and one optional row.
4. Compare `expectedSelectionRevision` with `invoice.selectionRevision ?? 0`.
5. Query `paymentAllocations.by_invoice` with `.first()`.
6. Reject if `amountPaid > 0` or any allocation exists.
7. Reject cancelled or paid invoices.
8. Reject duplicate line IDs, unknown rows, mandatory rows, and an empty update array.
9. Apply only `isSelected` booleans. Amounts and quantities are immutable.
10. Recalculate subtotal, waiver, discount, total, balance, status, and installments.
11. Reject a result whose total is zero or less. Mandatory charges must keep the invoice meaningful.
12. Rebuild installments across the existing schedule count, preserving IDs, labels, and due dates while redistributing the new total with the final row absorbing rounding.
13. Increment `selectionRevision` once if any value changed. A valid no-op returns the current invoice without incrementing.
14. Patch all changed fields atomically and return the authoritative projection.

The lock is permanent after the first allocation, including after reversal. Corrections after payment use controlled billing adjustments rather than changing optional rows.

Convex OCC protects payment and selection races because both transactions read and write the same invoice. After retry, selection sees `amountPaid` or the allocation and fails.

Online payment actions should accept `expectedSelectionRevision?: number`. Require it only when the invoice has mutable fee-plan optional rows. After creating a provider link, the internal attempt-recording mutation must reload the invoice and confirm the revision and amount still match before persisting or returning the URL. Legacy invoices without editable optional rows keep the old action contract.

## Shared projections and error contract

Use structured `ConvexError` data for new paths:

- `NOT_FOUND` for inaccessible collection, item, student, or invoice IDs
- `FORBIDDEN` when an authenticated actor lacks the required capability or Parent role
- `VALIDATION_FAILED` for empty selection, invalid quantity, ineligible class, or a trimmed request key outside 8 to 128 characters
- `IDEMPOTENCY_CONFLICT` when a request key is reused with a different fingerprint
- `DUPLICATE_INVOICE` when another non-cancelled invoice already exists for the same student, collection, session, and term
- `SELECTION_CONFLICT` with `currentRevision` for stale optional-row updates
- `SELECTION_LOCKED` with `reason: "payment_recorded" | "cancelled"`
- `ZERO_VALUE_INVOICE` if normalization or calculation would create a non-positive collection invoice or reduce an editable class-default invoice to zero

Cross-school and inaccessible Parent records return `NOT_FOUND`; they must not disclose tenant existence.

## Exact public API contracts

### `billing.listSelectableBillingCollections`

Type: query.

Arguments:

```ts
{ includeInactive?: boolean }
```

Return a bounded array:

```ts
type SelectableBillingCollection = {
  _id: Id<"selectableBillingCollections">;
  schoolId: Id<"schools">;
  bankAccountId: Id<"schoolBankAccounts"> | null;
  name: string;
  description: string | null;
  currency: string;
  targetClassIds: Id<"classes">[];
  targetClasses: Array<{ _id: Id<"classes">; name: string }>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  items: Array<{
    _id: Id<"selectableBillingItems">;
    label: string;
    description: string | null;
    unitAmount: number;
    category: BillingLineItemCategory;
    order: number;
    isActive: boolean;
  }>;
};
```

Authorization:

- `getAuthenticatedSchoolMembership` with either `finance.fee_plans.manage` or `finance.invoices.issue`
- Admin role via `assertAdmin`
- derive school from membership; do not accept `schoolId`

### `billing.createSelectableBillingCollection`

Type: mutation.

Arguments:

```ts
{
  bankAccountId?: Id<"schoolBankAccounts">;
  name: string;
  description?: string;
  currency?: string;
  targetClassIds: Id<"classes">[];
  items: Array<{
    label: string;
    description?: string;
    unitAmount: number;
    category?: BillingLineItemCategory;
  }>;
}
```

Return the exact collection projection above.

Authorization and validation:

- require `finance.fee_plans.manage` and Admin role
- derive school from membership
- require unique, active, same-school target classes
- require at least one item, unique normalized labels, finite positive amounts, and bounded arrays
- validate that an optional bank account is active, same-school, and matches currency
- insert the parent and items in one transaction

### `portal.listEligibleSelectableBillingCollections`

Type: query in `packages/convex/functions/portal.ts`.

Arguments:

```ts
{
  studentId: Id<"students">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
}
```

Return:

```ts
{
  student: {
    studentId: Id<"students">;
    classId: Id<"classes">;
    className: string;
  };
  collections: Array<{
    collectionId: Id<"selectableBillingCollections">;
    name: string;
    description: string | null;
    currency: string;
    existingInvoiceId: Id<"studentInvoices"> | null;
    canCreateInvoice: boolean;
    items: Array<{
      itemId: Id<"selectableBillingItems">;
      label: string;
      description: string | null;
      unitAmount: number;
      category: BillingLineItemCategory;
      order: number;
    }>;
  }>;
}
```

Authorization and filtering:

- resolve authenticated portal memberships
- require the membership associated with this student to have role `parent`
- require the student from `getPortalStudentAccess`
- require active student enrollment for new purchases
- session and term must be same-school and related
- return only active collections whose `targetClassIds` contains the student's current class
- return only active items belonging to each returned collection
- set `existingInvoiceId` from a non-cancelled invoice for the same student, collection, session, and term
- return a bounded result, ordered by collection name and item order

Student-role portal accounts do not receive the purchase catalog. They can continue viewing existing billing records.

### `portal.createSelectableInvoice`

Type: mutation in `packages/convex/functions/portal.ts`.

Arguments:

```ts
{
  requestKey: string;
  studentId: Id<"students">;
  collectionId: Id<"selectableBillingCollections">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  selections: Array<{
    itemId: Id<"selectableBillingItems">;
    quantity: number;
  }>;
}
```

Return:

```ts
{
  invoice: PortalBillingInvoice;
  replayed: boolean;
}
```

Atomic behavior:

1. Authorize the Parent and accessible student without accepting a school ID.
2. Normalize and validate a non-empty unique selection. Quantity must be a positive integer within the product limit.
3. Build the request fingerprint.
4. If the student's invoice history contains the request key, return the invoice with `replayed: true` only when the fingerprint matches. Otherwise throw `IDEMPOTENCY_CONFLICT`.
5. Reject another non-cancelled invoice for the same student, collection, session, and term with `DUPLICATE_INVOICE`.
6. Validate the active collection, current class eligibility, active selected items, ownership, school, session, and term.
7. Snapshot only chosen rows, calculate a positive total, build the one-payment schedule, insert the invoice, generate its number, and snapshot payment instructions in the same mutation.
8. Return the created positive invoice with `replayed: false`.

The mutation must not create a holding row, draft invoice, or zero-value invoice at any point.

### `billing.issueSelectableBillingItems`

Type: mutation.

Arguments:

```ts
{
  requestKey: string;
  collectionId: Id<"selectableBillingCollections">;
  studentIds: Id<"students">[];
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  selections: Array<{
    itemId: Id<"selectableBillingItems">;
    quantity: number;
  }>;
  bankAccountId?: Id<"schoolBankAccounts">;
  dueDate?: number;
  notes?: string;
}
```

Return:

```ts
{
  createdInvoices: BillingInvoice[];
  replayedInvoices: BillingInvoice[];
  skippedExistingStudentIds: Id<"students">[];
}
```

Authorization and behavior:

- require `finance.invoices.issue` and Admin role
- derive school from membership
- require a bounded, non-empty, unique student list and non-empty unique item selection
- validate all students, current classes, collection eligibility, items, session, term, quantities, bank account, and positive total before any insert
- derive each `classId` from the student
- use the per-student request-key fingerprint rule from the Parent mutation
- a same-key, same-fingerprint row goes to `replayedInvoices`
- a same-key, different-fingerprint row aborts the whole mutation with `IDEMPOTENCY_CONFLICT`
- a different-key non-cancelled duplicate goes to `skippedExistingStudentIds`
- create all remaining positive invoices atomically from the same immutable item and quantity snapshots

One student ID satisfies individual issuance. Several IDs satisfy selected-student issuance. The existing class-default bulk mutation remains unchanged.

### `billing.updateInvoiceOptionalSelections`

Type: Admin mutation.

Arguments:

```ts
{
  invoiceId: Id<"studentInvoices">;
  expectedSelectionRevision: number;
  selections: Array<{ lineItemId: string; isSelected: boolean }>;
}
```

Return:

```ts
{ invoice: BillingInvoice; changed: boolean }
```

Require `finance.invoices.issue`, Admin role, same-school invoice, fee-plan source, and the shared revision and lock helper.

### `portal.updateInvoiceOptionalSelections`

Type: Parent mutation.

Arguments and return match the Admin mutation.

Authorization:

- authenticated membership for the invoice student must be `parent`
- invoice student must come from `getPortalStudentAccess`
- inaccessible invoice IDs return `NOT_FOUND`
- invoice must be a class-default fee-plan invoice with mandatory and optional rows
- use the same revision, positive-total, installment, and payment-lock helper

### `portal.getBillingData`

Keep the existing arguments. Extend each invoice with:

```ts
selectionRevision: number | null;
canEditOptionalItems: boolean;
selectionLockReason:
  | null
  | "not_editable"
  | "parent_required"
  | "payment_recorded"
  | "cancelled";
lineItems: Array<{
  id: string;
  label: string;
  amount: number;
  category: string;
  order: number;
  isOptional: boolean;
  isSelected: boolean;
  unitAmount: number;
  quantity: number;
}>;
```

Project missing legacy `isSelected` as `true`. Project missing quantity as `1` and `unitAmount` as `amount`. Do not patch during reads.

Determine editability from Parent role, fee-plan source, mandatory and optional row presence, status, `amountPaid`, and `paymentAllocations.by_invoice`. Keep household and student summaries based on persisted invoice totals.

### Online payment actions

Extend compatibly:

```ts
billing.initializeOnlinePayment({
  schoolId,
  invoiceId,
  amount,
  email,
  description,
  callbackUrl?,
  expectedSelectionRevision?,
})

billing.initializePortalOnlinePayment({
  invoiceId,
  callbackUrl?,
  expectedSelectionRevision?,
})
```

Require the effective revision for invoices with editable fee-plan optional rows. Recheck revision and exact committed balance in the internal attempt mutation before returning the provider URL. Collection invoices have fixed positive composition and do not require a selection revision.

## Authorization matrix

| Operation | Actor | Required check |
| --- | --- | --- |
| List Admin collections | Admin user | `finance.fee_plans.manage` or `finance.invoices.issue`, plus Admin role |
| Create collection | Admin user | `finance.fee_plans.manage`, plus Admin role |
| Issue selected collection items | Admin user | `finance.invoices.issue`, plus Admin role |
| Update fee-plan optional rows | Admin user | `finance.invoices.issue`, plus same-school invoice |
| List eligible Parent collections | Parent | active Parent membership and accessible active student |
| Create collection invoice | Parent | active Parent membership, accessible student, current class eligibility |
| Update fee-plan optional rows | Parent | active Parent membership and accessible invoice student |
| View existing billing | Parent or student | active portal membership and accessible student |
| Open portal payment link | Parent or student | existing portal payment context and current revision when required |

No new public operation accepts `schoolId` for authorization. The existing Admin payment action may keep its `schoolId` argument only because it compares it with authenticated membership before loading invoice data.

## UI flow

### Admin `/billing`

1. Keep compulsory class-default plans in the existing Plans tab.
2. Add a "Selectable items" tab with collection setup and collection list.
3. Collection setup asks for name, eligible classes, currency, bank account, and item unit prices. It has no installment controls.
4. "Issue items" asks for collection, eligible class, one or more students, at least one item, quantity for each chosen item, session, term, due date, and review.
5. The review step shows only the selected item snapshots and a positive per-student total. Submission uses a generated request key retained across retries.
6. Show created, replayed, and skipped-existing results separately.
7. Keep class-default bulk invoicing unchanged. For new fee plans with optional rows, send `optionalSelectionMode: "parent_selectable"` and show mandatory initial total separately from optional available total.
8. Show optional controls in invoice detail only for editable fee-plan invoices. Collection invoices are already committed purchases and show fixed snapshots.
9. Do not revive the unrelated generic single-fee-plan invoice form. Individual selectable issuance is covered by passing one student ID.

Expected Admin files for Build:

- `apps/admin/app/billing/page.tsx`
- `apps/admin/app/billing/types.ts`
- `apps/admin/app/billing/hooks/useBillingActions.ts`
- `apps/admin/app/billing/hooks/useBillingData.ts`
- `apps/admin/app/billing/components/BillingTabs.tsx`
- `apps/admin/app/billing/components/BillingSidebar.tsx`
- `apps/admin/app/billing/components/forms/FeePlanForm.tsx`
- focused collection and issuance components under `apps/admin/app/billing/components/`

### Parent Portal `/billing`

1. For the selected active student, query eligible collections separately from invoices.
2. Show each collection as available items, not money owed.
3. Require at least one checked item and a positive integer quantity before enabling "Create invoice."
4. Keep the request key stable while retrying the same submission. On success or replay, close the chooser and show the positive invoice returned by the mutation.
5. If a duplicate exists under a different key, link the parent to `existingInvoiceId` rather than creating another.
6. On class-default invoices, show optional rows with selected state. Parent users can revision-update them before payment; student users see read-only rows.
7. Replace local totals with the mutation response. On `SELECTION_CONFLICT`, discard local edits and show the refreshed invoice. On `SELECTION_LOCKED`, disable controls.
8. Enable payment only after invoice creation or optional-row mutation returns an authoritative positive balance.

Expected Portal files for Build:

- `packages/convex/functions/portal.ts`
- `apps/portal/lib/portal-types.ts`
- `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`

## Backend file plan

1. Update `docs/features/BillingAndPaymentsFoundation.md` before source implementation. State that catalogs are not invoices and document both Parent creation and class-default optional-row updates.
2. Add the dedicated tables and compatible optional fields in `packages/convex/schema.ts`.
3. Add validators, fingerprint normalization, snapshot builders, legacy inclusion, and total helpers in `packages/convex/functions/billingShared.ts`.
4. Add Admin collection APIs, positive issuance, optional-row updates, and payment revision checks in `packages/convex/functions/billing.ts`.
5. Add eligible-collection, atomic Parent creation, optional-row update, and projections in `packages/convex/functions/portal.ts`.
6. Widen portal identity helper contexts to `QueryCtx | MutationCtx` in `packages/convex/functions/academic/portalIdentity.ts`. Reuse those helpers instead of duplicating family-link checks.
7. Register both tables in `packages/convex/functions/academic/branchSplitV2.ts`, `tenantPurgeManifest.ts`, and `seed.ts`. Collections precede items, and both precede invoices. Remap `studentInvoices.selectableCollectionId`. Treat nested source item IDs as non-authoritative provenance if the branch copier cannot remap nested values.
8. Regenerate Convex types after schema and API changes.

## Focused tests

Add focused Convex integration cases in `packages/convex/functions/billing.integration.test.ts`, or use `billingSelectable.integration.test.ts` if separation improves cohesion.

### Collection and invoice creation

- listing eligibility creates no invoice and changes no dashboard or group totals
- zero selected items rejects and writes nothing
- zero, fractional, negative, duplicate, or excessive quantities reject
- Parent selection atomically creates one positive invoice with only selected snapshots
- Admin individual and multi-student issuance create only positive invoices
- snapshot names, unit prices, quantities, and extended amounts survive catalog edits and archival
- wrong class, archived student, inactive collection, inactive item, wrong-school IDs, and mismatched session/term fail closed
- bank instructions snapshot on the positive invoice
- collection invoice gets one full-payment installment equal to total

### Duplicate and idempotency behavior

- same Parent request key and same normalized payload returns the same invoice with `replayed: true`
- same request key with reordered equivalent selections replays
- same request key with changed item, quantity, context, actor identity, or actor kind throws `IDEMPOTENCY_CONFLICT`
- different request key for an existing non-cancelled collection invoice throws `DUPLICATE_INVOICE`
- cancelled prior invoice permits a new request
- Admin retry separates replayed, newly created, and skipped-existing recipients
- an Admin idempotency conflict aborts all writes in the batch

### Fee-plan optional rows

- legacy optional row with missing `isSelected` remains included on read and in calculations
- deployment performs no invoice backfill
- new legacy-mode plan preserves included optional behavior
- new parent-selectable class-default invoice starts optional rows explicit `false` and keeps a positive mandatory total
- parent-selectable plan without a mandatory row rejects
- issuance that would retain only a zero-value optional choice rejects
- Parent and Admin revision updates recalculate subtotal, discounts, balance, status, and installment amounts
- deselecting all optional rows remains valid when mandatory net total stays positive
- update that would reduce total to zero rejects
- stale revision rejects without writes
- `amountPaid > 0` rejects
- an allocation row rejects even if `amountPaid` is inconsistent at zero
- unrelated Parent, student-role viewer, and cross-school Admin cannot update

### Payment and aggregate regressions

- payment initialization requires the current revision only for mutable fee-plan invoices
- attempt persistence rejects changed revision or balance
- payment and selection race cannot commit both compositions
- unselected fee-plan rows do not inflate Admin, Portal, or group outstanding totals
- collection eligibility does not appear in outstanding totals until invoice creation
- existing compulsory class-default bulk invoices retain prior totals and schedules

Add focused component tests for Admin positive-total review, request retry handling, Parent eligible collection selection, duplicate navigation, stale revisions, payment lock, and student read-only state. Avoid snapshots.

## Verification commands for Build

```bash
pnpm --filter @school/convex test -- functions/billing.integration.test.ts
pnpm --filter @school/convex convex:codegen
pnpm --filter @school/convex typecheck
pnpm --filter @school/admin test
pnpm --filter @school/admin typecheck
pnpm --filter @school/admin build
pnpm --filter @school/portal test
pnpm --filter @school/portal typecheck
pnpm --filter @school/portal build
node scripts/audit-theme-colors.mjs
```

If selectable tests use a second file, include it in the focused Convex command. Do not deploy without separate authorization and a confirmed environment.

## Acceptance criteria

- Reading eligible collections creates no invoice and no receivable.
- Parent can see only active collections eligible for an accessible active student's current class.
- Parent must choose at least one item and valid quantity before one atomic mutation creates a positive invoice.
- Admin individual and multi-student issuance require selected items and create only positive invoices.
- Same-key, same-payload retries return prior invoices; changed payloads fail; different-key duplicates do not create a second active invoice.
- Collection invoice history keeps item names, unit prices, quantities, and extended amounts as immutable snapshots.
- Legacy missing `isSelected` stays included until an authorized user explicitly changes it.
- New parent-selectable class-default invoices start optional rows unselected while mandatory net charges keep totals positive.
- Optional-row changes use revisions, recalculate every dependent amount and installment, and cannot reduce an invoice to zero.
- Any positive `amountPaid` or payment allocation permanently locks optional-row changes.
- Payment links use the committed balance for the current revision.
- Existing compulsory bulk invoicing remains compatible.
- Focused backend and UI checks pass.

## Risks and non-goals

- Per-student idempotency lookup uses the existing `by_student` index and a bounded history scan. If real student invoice histories approach the cap, add a staged compound index in a separate deployment sequence rather than shipping an unbounded read.
- A provider URL rejected by the post-provider revision check may remain orphaned at the provider, although the client never receives it. Gateway cancellation is outside this feature.
- Inventory, sizes, stock, suppliers, returns, fulfilment, parent changes to a committed collection invoice, and collection editing beyond required creation are out of scope.
- Historical backfill is out of scope. Compatibility lives in explicit write policies and read projections.

## Builder handoff

Read these first:

1. `docs/tasks/orchestrator-sessions/orch-20260914-073210/master_plan.md`
2. this corrected architecture result
3. `packages/convex/_generated/ai/guidelines.md`
4. `packages/convex/functions/billingShared.ts`
5. `packages/convex/functions/billing.ts:411-504` and `:2428-2717`
6. `packages/convex/functions/portal.ts:717-888`
7. `packages/convex/functions/academic/portalIdentity.ts`
8. the Admin and Portal billing components named above

The boundary is strict: collections advertise eligible choices, while invoices record committed positive charges. Never create an invoice merely because a student can buy something.
