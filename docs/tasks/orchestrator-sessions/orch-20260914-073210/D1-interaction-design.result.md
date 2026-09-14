# D1 selectable billing interaction design

## Status and source of truth

This document is the implementation source of truth for B2 and B3 UI behavior. The corrected G1 architecture remains authoritative for data, authorization, calculations, and error codes. If the UI draft and a mutation response disagree, render the mutation response.

The product boundary must stay visible in the interface:

- A selectable collection is a catalog of items available to eligible students.
- Browsing a collection does not create an invoice, debt, or outstanding balance.
- Confirming at least one item creates a positive invoice.
- A collection invoice is a committed purchase and is not editable in this feature.
- Optional rows on a class-default invoice may be changed before any payment, subject to revision checks.

## Discovery findings

### Current patterns to preserve

- `apps/admin/app/billing/page.tsx:79` owns the Admin billing workspace, with a scrollable main area and a persistent 400 px action rail at the `lg` breakpoint.
- `apps/admin/app/billing/components/BillingTabs.tsx:10` defines the current Overview, Invoices, Payments, Plans, and Config tabs as horizontally scrollable compact pills.
- `apps/admin/app/billing/components/BillingSidebar.tsx:29` centralizes desktop rail and mobile-sheet billing actions. New forms should use this form language rather than introduce a second dialog system.
- `apps/admin/lib/components/ui/AdminSheet.tsx` provides the existing modal-sheet behavior below `lg`. Forms use 40 to 44 px controls, compact labels, pinned actions, and scrollable bodies.
- `apps/admin/app/billing/components/InvoiceTable.tsx:28` keeps wide ledger tables in horizontal overflow. Selectable collection data should become cards on mobile instead of forcing another wide table.
- `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:715` renders billing inside the existing `max-w-4xl` portal workspace. Invoice cards use receipt-style line items, totals, payment instructions, and one full-width payment button.
- `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:728` has an invoice skeleton already. Eligible collections need an independent loading state so invoice history does not disappear while the catalog query loads.
- `apps/portal/tailwind.config.js:27-36` exposes tenant-derived `brand.primary`, contrast, surface, border, and focus tokens. New Portal primary actions use those tokens. Statuses continue to use semantic emerald, amber, and rose colors.

### Review findings

1. **High.** `apps/admin/app/billing/components/forms/FeePlanForm.tsx:421` and `apps/admin/app/billing/components/FeePlanList.tsx:289` label mandatory plus optional values as "Total (All Included)." For new parent-selectable class-default plans this misstates the initial receivable. Replace it with separate "Initial invoice total" and "Optional items available" values.
2. **High.** `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:779` renders every invoice line as committed. `apps/portal/lib/portal-types.ts:81` has no optional-selection metadata. The Parent UI cannot distinguish mandatory, selected optional, unselected optional, editable, or payment-locked rows until B1 expands the projection.
3. **Medium.** `apps/admin/app/billing/components/BillingTabs.tsx:10` and `apps/admin/app/billing/components/BillingSidebar.tsx:29` expose no collection or selected-item issuance route. The new flow needs one dedicated tab and two contextual actions. It must not reuse Bulk Invoicing, which means compulsory class-default issuance.
4. **Medium.** `apps/admin/app/billing/components/InvoiceTable.tsx` exposes Invoice and Statement actions only. Authorized Admin users need a conditional "Manage choices" action for editable fee-plan invoices. Collection invoices remain fixed snapshots.
5. **Medium.** `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx:860` uses "No invoices" as the only billing empty state. That cannot communicate the separate cases of no debt, no eligible collections, inactive enrollment, or a student-role viewer.
6. **Low.** The Portal payment history table below the invoice list has no mobile-specific layout. B3 should use stacked payment rows below `sm`; do not increase horizontal overflow while adding billing controls.

## User-facing structure

### Admin `/billing`

Add a sixth tab after Plans:

`Overview | Invoices | Payments | Plans | Selectable items | Config`

The tab label is "Selectable items," not "Uniforms," "Shop," or "Extras." Plans remain the home for compulsory class-default fee structures. Bulk Invoicing remains unchanged.

The Selectable items tab contains:

1. A short explanation and two actions.
2. The active collection list.
3. An optional "Show inactive" checkbox backed by `includeInactive: true`.
4. Empty, loading, and query error states scoped to this tab.

Desktop actions open in the existing right rail. Mobile and tablet actions open in `AdminSheet`. Add these sidebar variants:

- `collection`: title "New selectable collection"
- `issuance`: title "Issue selected items"

The Financial Hub action list may include "Issue selected items," but collection creation stays in the Selectable items tab so users without plan-management permission do not see a dead action.

### Parent Portal `/billing`

Keep the current page route and student switcher. Within `BillingView`, use this order:

1. "Fees & payments" summary based only on persisted invoice totals.
2. "Available to buy" section, Parent and active enrollment only.
3. "Invoices" section.
4. "Payment history" section.

The Available to buy section must not sit inside the outstanding summary card. Its heading support copy is fixed:

> Choose items for {student first name}. Browsing these options does not add anything to your balance.

Student-role viewers do not call `portal.listEligibleSelectableBillingCollections`. They see existing billing data followed by:

> Purchases can only be created by a linked parent or guardian.

## Admin collection flow

### Collection list wireframe

```text
SELECTABLE ITEMS                                      [Issue items] [New collection]
Create collections for items families may choose. Eligibility does not create an invoice.

[ ] Show inactive

+-----------------------------------------------------------------------+
| Primary books                                             ACTIVE       |
| Workbooks and reading packs                                            |
| Eligible: Primary 1, Primary 2, Primary 3                              |
| 4 items | NGN | Settlement: Main school account                       |
| Updated 14 Sep 2026                                      [Issue items] |
+-----------------------------------------------------------------------+
```

Collection cards show, in order:

1. Name and Active or Inactive semantic badge.
2. Description, omitted without placeholder when absent.
3. "Eligible:" followed by up to three class names and "+N more."
4. Active item count, currency, and bank account name or "School default account."
5. Updated date and "Issue items" action.

Do not show a collection total. Items have quantities, so summing one of each suggests a price that may never be charged. There is no edit, archive, stock, size, fulfilment, or return action in D1.

### New collection form

Field order and exact labels:

1. `Collection name *`
   - Placeholder: `e.g. Primary books`
2. `Description`
   - Placeholder: `What this collection is for`
3. `Eligible classes *`
   - Multi-select chips with visible selected count.
   - Helper: `Students in these classes may view or receive these items. No invoice is created until items are selected.`
   - No "All classes" or universal option. Empty is invalid.
4. `Currency *`
   - Default from billing settings. Use the existing supported currency control.
5. `Settlement account`
   - Reuse `BankAccountSelection`.
   - Helper: `Optional. The school default is used when no account is selected.`
6. `Items *`

Each item row uses this field order:

1. `Item name *`
2. `Description`
3. `Category *`
4. `Unit price *`
5. `Remove item`, icon button with an accessible label

The first item row exists by default. "Add another item" appends a row and moves focus to its Item name. Preserve visual order as backend `order`. Categories use the existing billing categories without creating a product taxonomy.

Pinned footer:

```text
{N} items | {N} eligible classes                  [Create collection]
```

The button label while pending is `Creating collection...`. Disable all fields and close controls during the mutation to prevent duplicate submits.

### Collection validation and responses

Show inline errors next to fields and a summary above the pinned footer when submit reveals more than one error.

| Condition | Copy and behavior |
| --- | --- |
| Missing name | `Enter a collection name.` Focus Collection name. |
| No eligible class | `Select at least one eligible class.` |
| No item | `Add at least one item.` |
| Blank item label | `Enter a name for this item.` |
| Duplicate normalized labels | `Item names must be unique in this collection.` Mark both rows. |
| Unit price missing, non-finite, zero, or negative | `Enter a unit price greater than 0.` |
| Invalid account or currency mismatch | `Choose an active settlement account in {currency}, or use the school default.` |
| Server `VALIDATION_FAILED` | Keep the draft, show the server-safe message in the summary, and focus the first mapped field. |
| Server `NOT_FOUND` | `A selected class or account is no longer available. Review the highlighted fields and try again.` Reload options and clear only missing IDs. |
| Server `FORBIDDEN` | Close the form, refresh capability state, and show `You no longer have permission to create selectable collections.` |
| Network/unknown failure | Keep the full draft and show `Collection was not created. Check your connection and try again.` |
| Success | Toast `Collection created` with `{name} is ready for eligible students.` Close the form and focus the new collection card. |

### Empty and loading states

- List loading: three compact collection-card skeletons. Keep tab title and actions visible.
- No active collections with create permission: `No selectable collections yet.` Support copy: `Create a collection before issuing selected items.` Action: `New collection`.
- No active collections without create permission: `No selectable collections are available.` No action.
- Inactive-only after enabling Show inactive: render the inactive cards, never merge them into the default list without their badges.
- Query failure: inline error surface with `Collections could not be loaded.` and `Try again`. Do not replace the rest of the billing workspace.

## Admin issue-items flow

Use a three-step form. The rail header shows `1 Recipients`, `2 Items`, `3 Review`. Users can go back before submission. Do not submit or create a draft invoice between steps.

### Step 1: recipients

Field order:

1. `Collection *`
   - Active collections only.
   - When opened from a collection card, preselect it.
2. `Session *`
3. `Term *`
   - Disabled until Session is selected.
4. `Eligible class *`
   - Options are the selected collection's target classes.
5. `Students *`
   - Search field placeholder: `Search name or admission number`
   - Checkbox list of active students in the selected eligible class.
   - Controls: `Select all shown` and `Clear`.
   - Count line: `{N} students selected`.

Changing Collection clears class, students, and item selections. Changing Eligible class clears students after a confirmation only when students are already selected. Session changes clear Term.

Primary button: `Continue to items`.

Validation copy:

- `Select a collection.`
- `Select a session and term.`
- `Select an eligible class.`
- `Select at least one student.`
- Empty class roster: `No active students are enrolled in this class.`

### Step 2: items and invoice details

Item selector wireframe:

```text
[ ] Mathematics workbook
    NGN 4,500 each
    Quantity  [-] [ 1 ] [+]        Line total NGN 4,500

[x] Reading anthology
    NGN 3,000 each
    Quantity  [-] [ 2 ] [+]        Line total NGN 6,000
```

Checkboxes select items. A newly selected item starts at quantity 1. An unselected item's quantity control is disabled but retains no submitted quantity. Quantity is a whole-number text input with minus and plus controls. Use the B1 product maximum in `max`, validation, and helper copy.

Below items:

1. `Due date`
   - Optional; helper: `Leave blank to use the school billing default.`
2. `Settlement account`
   - Preselect the collection account if present, otherwise school default.
3. `Notes`
   - Placeholder: `Optional note shown on the invoice`

Sticky summary:

```text
Selected items 2
Per-student total NGN 10,500
Recipients 6
Invoices to create 6
```

The per-student total here is a client review calculation only. Label it `Estimated per-student total` until the mutation returns. Primary button: `Review issuance`.

Validation copy:

- Empty selection: `Select at least one item.`
- Invalid quantity: `Enter a whole-number quantity from 1 to {max}.`
- Non-positive calculated total: `Selected items must have a total greater than 0.`
- Account mismatch: same copy as collection creation.

### Step 3: review and confirmation

```text
REVIEW ISSUANCE
Collection       Primary books
Period           2026/2027 · First term
Class            Primary 2
Recipients       6 students                         [View names]
Due date         School default / 30 Sep 2026
Settlement       Main school account

ITEMS PER STUDENT
Reading anthology       2 × NGN 3,000       NGN 6,000
Mathematics workbook    1 × NGN 4,500       NGN 4,500

Estimated per-student total                     NGN 10,500
Invoices to create                                      6

This creates a positive invoice for each eligible student. It does not reserve stock.
                                      [Back] [Create 6 invoices]
```

The recipient-name disclosure is collapsed by default. The submit button says `Create 1 invoice` or `Create {N} invoices`. Pending copy is `Creating invoices...`; disable Back, close, and all fields during submission.

Generate one request key when the user first submits this reviewed payload. Retain it for an unchanged retry after timeout or unknown failure. If the user returns and edits any fingerprint field after a submission attempt, generate a new key for the next submit. A resulting duplicate response must link to the existing invoices rather than imply nothing happened.

### Issuance results

Replace the review body with an outcome summary. Use returned authoritative amounts and invoice references.

```text
ISSUANCE COMPLETE
4 created
1 confirmed from an earlier attempt
1 already had this collection for the period

Created (4)                         [View invoices]
Confirmed retry (1)                [View invoice]
Skipped existing (1)
  Ada Okafor · Existing invoice                       [Open invoice]

                                                   [Done]
```

Use these labels exactly:

- `Created`
- `Confirmed from an earlier attempt`
- `Skipped because an invoice already exists`

A mixed result is success, not an error. Toast: `Issuance complete` and summarize all three counts.

Contract states:

| Contract result/error | UI behavior |
| --- | --- |
| `createdInvoices` | List references under Created and refresh the ledger. |
| `replayedInvoices` | List under Confirmed from an earlier attempt. Do not call them newly created. |
| `skippedExistingStudentIds` | Resolve names from the submitted roster and provide an invoice link after refreshed data identifies it. |
| `IDEMPOTENCY_CONFLICT` | Blocking error: `This retry no longer matches the original request. Review current invoices before trying again.` Action `Open invoices`. Do not silently create a new key. |
| `VALIDATION_FAILED` | Keep selections. Show the server-safe message, return to the relevant step, and mark invalid fields. For eligibility changes use `A student's class or enrollment changed. Review recipients and try again.` |
| `NOT_FOUND` | `The collection, an item, or a student is no longer available.` Reload data, remove missing choices, and require review again. |
| `FORBIDDEN` | Close the form and show `You no longer have permission to issue invoices.` |
| Unknown/timeout | `We could not confirm the result. Retry without changing this request.` Keep the request key and show `Retry same request`. |

## Admin class-default optional rows

### Fee-plan creation copy correction

Keep the optional toggle for genuine optional rows within a positive class-default invoice. Remove the "Uniform" and "Bus Service" optional presets from `FeePlanForm`; those examples belong in selectable collections. Generic optional rows remain supported.

When a class-default plan contains optional rows, send `optionalSelectionMode: "parent_selectable"`. The form summary becomes:

```text
Initial invoice total          NGN 120,000
Optional items available        NGN  15,000
If every optional item is chosen
Maximum invoice total          NGN 135,000
```

Helper below the optional toggle:

> Starts unselected. A parent or authorized Admin can add this item before the first payment.

Reject a parent-selectable plan without a positive mandatory base. Do not offer parent-selectable optional rows for `manual_extra` mode.

### Manage choices from Admin invoice detail

Add `Manage choices` beside Invoice and Statement only when `canEditOptionalItems` is true and the user has `finance.invoices.issue`. For a locked editable-source invoice, use `View choices` instead. Never show this action for collection invoices with fixed snapshots.

The sheet shows mandatory rows as read-only and optional rows as checkboxes. Use the same content and save model as the Parent invoice editor below. The button label is `Save invoice choices`. Payment handoff actions stay disabled while local changes are unsaved or the save mutation is pending.

On `SELECTION_CONFLICT`, discard local edits, replace the sheet with the latest authoritative invoice, and show:

> Choices changed in another session. We refreshed this invoice. Review it before saving again.

On `SELECTION_LOCKED`, refresh and switch to read-only:

> Choices are locked because a payment has been recorded. Use a billing adjustment for corrections.

On `ZERO_VALUE_INVOICE`, retain the draft and show:

> This change would reduce the invoice total to zero. Keep at least the required charges.

## Parent selectable collection flow

### Available collections list

```text
AVAILABLE TO BUY
Choose items for Amara. Browsing these options does not add anything to your balance.

+----------------------------------------------------------------+
| Primary books                                                   |
| Workbooks and reading packs                                     |
| 4 items from NGN 2,500                         [Choose items]    |
+----------------------------------------------------------------+
```

"From" is permitted only when active items have different prices and it uses the minimum unit price. Do not show a summed collection total. Existing debt badges and overdue colors never appear on collection cards.

If `existingInvoiceId` is present, replace the action with `View invoice` and show the neutral line `Already invoiced for this term.` If `canCreateInvoice` is false without an existing invoice, disable the action and show the query-provided or locally derived reason only when the contract provides enough information. Do not guess.

### Inline chooser

Expand one collection card at a time. This avoids a new Portal dialog pattern and keeps the chosen student, collection, and debt boundary in view.

```text
PRIMARY BOOKS                                         [Close]
Available for Amara · Primary 2
Selecting items below does not change your balance yet.

[x] Mathematics workbook
    Practice workbook
    NGN 4,500 each
    Quantity  [-] [1] [+]             NGN 4,500

[ ] Reading anthology
    NGN 3,000 each
    Quantity  [-] [1] [+]             Not selected

Selected items 1
Estimated total                               NGN 4,500
                                               [Review order]
```

Changing the active student closes the chooser and clears its draft. Changing session or term does the same. Do not carry a selection between students, collections, sessions, or terms.

`Review order` stays disabled until at least one item has a valid positive integer quantity and the estimated total is positive. Disabled helper when nothing is selected: `Select at least one item to continue.`

### Confirmation

Replace the chooser body with:

```text
REVIEW ORDER
For              Amara Okafor · Primary 2
Collection       Primary books
Period           2026/2027 · First term

Mathematics workbook       1 × NGN 4,500       NGN 4,500

Estimated total                                NGN 4,500

Confirming creates an invoice and adds this amount to your balance.
Items in this order cannot be changed here after invoice creation.
Contact the school if a correction is needed.

                                      [Back] [Create invoice]
```

No payment button appears before invoice creation. `Create invoice` calls `portal.createSelectableInvoice` once. Pending copy is `Creating invoice...`; disable Back, Close, student switching, and all selection controls until it resolves.

Use the same stable request-key behavior as Admin issuance. After an unknown failure, offer `Retry same order` without changing the key.

### Success and payment handoff

On success or `replayed: true`:

1. Collapse the chooser.
2. Scroll and focus the returned invoice card.
3. Replace every estimated value with the returned invoice values.
4. Announce in an `aria-live="polite"` region:
   - New: `Invoice {number} created. Balance due {amount}.`
   - Replay: `Invoice {number} was already created. We opened it below.`
5. Render payment instructions and `Pay {authoritative balance} now` only from the returned/refreshed invoice.

A collection invoice line uses:

`{label}`
`{quantity} × {unit price}` at left, extended amount at right.

These are immutable snapshots. No checkbox or quantity stepper appears on the invoice card.

Contract states:

| Contract result/error | Copy and behavior |
| --- | --- |
| `DUPLICATE_INVOICE` | Close chooser, use `existingInvoiceId` or refreshed invoice data, and show `An invoice already exists for this collection and term.` Action `View invoice`. |
| `IDEMPOTENCY_CONFLICT` | `This retry no longer matches the original order. Open the existing invoice before trying again.` Do not auto-submit with a new key. |
| `VALIDATION_FAILED` | Keep the draft where safe. Map empty/quantity errors inline. For changed eligibility show `This collection is no longer available for {student}.` Close after acknowledgement and refresh. |
| `NOT_FOUND` | `This collection or one of its items is no longer available.` Refresh, remove missing items, and require a new review. Inaccessible student IDs use the same generic page error and reveal no record. |
| `FORBIDDEN` | `Only a linked parent or guardian can create this invoice.` Close chooser. Existing invoices remain readable. |
| `ZERO_VALUE_INVOICE` | `Select items with a total greater than 0.` Return to selection. |
| Unknown/timeout | `We could not confirm whether the invoice was created.` Keep the request key. Actions: `Retry same order` and `Check invoices`. |

## Parent class-default optional-row editing

### Invoice card layout

For fee-plan invoices with optional rows, render all mandatory and optional snapshots. Rows use these states:

- Mandatory: no checkbox, optional secondary label omitted.
- Selected optional, editable: checked checkbox and label `Optional`.
- Unselected optional, editable: unchecked checkbox, subdued row, amount remains visible, and label `Not included`.
- Locked optional: checkbox replaced by checked or empty read-only icon. Keep the amount visible.

Invoice wireframe:

```text
Term fees                                      ISSUED
INV-1042 · Due 30 Sep 2026

Tuition                                       NGN 120,000
[x] Excursion                         Optional  NGN  10,000
[ ] Club fee                       Not included NGN   5,000

Estimated total after changes                 NGN 130,000
Current saved total                           NGN 120,000
                                  [Discard] [Save choices]

Balance due                                   NGN 120,000
                                          [Pay NGN 120,000 now]
```

Before save, the projected value must be labeled `Estimated total after changes`. Keep `Current saved total` and the payment amount authoritative. Disable Pay while the invoice has unsaved edits or the save mutation is pending. Do not initialize payment from local totals.

After `portal.updateInvoiceOptionalSelections` succeeds:

- Replace the whole invoice from `result.invoice`.
- Clear dirty state.
- If `changed` is true, announce `Invoice choices saved. New balance due {amount}.`
- If `changed` is false, announce `No invoice choices changed.`
- Enable Pay using the returned balance and revision.

Pass `expectedSelectionRevision` into payment initialization for mutable fee-plan invoices. While payment initialization runs, disable optional controls as well as Pay. If initialization rejects because revision or amount changed, refresh and show:

> This invoice changed before checkout opened. Review the latest total and try again.

### Locked and read-only copy

Use the projection, not client inference alone:

| `selectionLockReason` | UI copy |
| --- | --- |
| `payment_recorded` | `Choices are locked because a payment has been recorded.` |
| `cancelled` | `This invoice is cancelled. Choices cannot be changed.` |
| `parent_required` | `A linked parent or guardian can change optional items.` |
| `not_editable` | No edit helper unless optional rows exist. If they do: `These invoice items are fixed.` |
| `null` with `canEditOptionalItems: true` | Editable controls. |

Any payment allocation locks choices permanently, even if `amountPaid` later displays zero. Do not offer an unlock, reset, or retry-edit action.

### Stale revision behavior

On `SELECTION_CONFLICT`:

1. Discard the local optional-row draft.
2. Replace the invoice with the latest projection or trigger a scoped refresh.
3. Keep the card expanded and move focus to the warning.
4. Show `Choices changed elsewhere. We refreshed this invoice. Review the latest total before saving.`
5. Require a new user action. Never replay the stale mutation automatically.

On `SELECTION_LOCKED`, follow the same refresh pattern, switch to read-only, and use the payment-recorded or cancelled copy from the returned reason.

On `ZERO_VALUE_INVOICE`, keep controls editable and local choices intact. Show `This selection would reduce the invoice total to zero. Keep at least the required charges.`

## Payment states

- Payment is available only for an existing invoice with an authoritative positive `balanceDue`, a payable status, and `canPayOnline`.
- Collection browsing, item selection, and review never show Pay.
- Button pending copy remains `Opening Paystack...` to match the current Portal.
- Disable all Pay buttons while any payment initialization is in progress, matching the current single-flight behavior.
- Payment initialization failure keeps the invoice visible and shows an invoice-scoped error when possible: `Online payment could not be started. Your invoice has not changed.`
- If online payment is unavailable, retain `InvoicePaymentInstructions`. Do not show a disabled Pay button with no explanation.
- Paid invoice: semantic success badge and no item controls.
- Partially paid invoice: payment action may remain for the balance, but optional choices are read-only.
- Cancelled invoice: no payment action and no editable choices.

## Loading, empty, permission, and stale catalog states

### Parent loading

Load invoices and eligible collections independently:

- Billing query loading: retain the current heading skeleton and render two invoice-card skeletons.
- Eligible collection query loading: render the Available to buy heading, debt-boundary support copy, and two 88 px card skeletons.
- Mutation pending: preserve layout dimensions; change button copy and disable the relevant form.
- Payment pending: keep current invoice visible and prevent a second initialization.

### Parent empty states

| State | Copy |
| --- | --- |
| No invoices, eligible collections exist | Invoice section: `No invoices for {student} right now.` Available to buy remains above it. |
| No invoices and no eligible collections | `No invoices or available items for {student} right now.` Do not say all fees are settled unless summary confirms zero. |
| Invoices exist, no eligible collections | Omit collection cards and show `No additional items are available for this class and term.` |
| Historical or inactive enrollment | `Purchases are unavailable because this is not an active enrollment.` Existing billing remains visible. |
| No linked student | `No student is linked to this portal account.` No catalog query. |
| Student-role viewer | `Purchases can only be created by a linked parent or guardian.` Existing invoices and payment access remain visible. |
| Eligible collection has no active items | Backend should omit it. If observed after a refresh race, hide it rather than render an empty chooser. |

### Permission handling

Admin:

- Hide New collection without `finance.fee_plans.manage`.
- Hide Issue items and Manage choices without `finance.invoices.issue`.
- A user with issue permission but not manage permission may list collections and issue them.
- If a server call returns `FORBIDDEN` after a capability change, close the mutating form, preserve no sensitive result data, refresh access state, and show the exact task-level copy defined above.

Portal:

- Do not query the purchase catalog for a student-role viewer.
- Parent controls only appear for the currently selected accessible active student.
- `NOT_FOUND` for an inaccessible student, invoice, item, or collection must use generic copy. Never name or confirm the inaccessible record.

### Stale catalog behavior

An open chooser may become stale if a collection or item is deactivated, repriced, renamed, or its class targeting changes.

- Before confirmation, a reactive query update replaces current catalog values. If selected item price or label changes, clear review state, keep valid selections, and show `Available items changed. Review the latest prices before continuing.`
- If a selected item disappears, remove it and show `{item label} is no longer available.` If no selections remain, disable Review.
- If the collection becomes inactive or the student loses class eligibility, close the chooser and show the unavailable copy.
- Never preserve a local price over the live catalog at creation. After creation, render invoice snapshots even if the catalog later changes.

## Responsive specification

### Breakpoints

Use the repository breakpoints already present in these screens:

- Below `sm` at 640 px: phone layout.
- `sm` through 1023 px: tablet layout with `AdminSheet` for Admin actions.
- `lg` at 1024 px and above: Admin persistent 400 px action rail.

### Admin

- Tabs remain horizontally scrollable in one row. Do not wrap six tabs into two lines.
- Below `sm`, stack the Selectable items heading, support copy, and actions. Both actions are full width, New collection first and Issue items second.
- Collection cards are one column below `md`, two columns from `md`, and up to three only when the content width permits. Never truncate class eligibility without a `+N more` count.
- Collection form item rows stack label, description, category, and amount on phones. Remove stays at the top right with a 44 px target.
- Issue steps use one column. Session and Term stack below `sm`; they may share a row from `sm`.
- Student checkbox rows remain at least 44 px high. The roster has its own scroll region only when the sheet retains a visible step header and footer.
- On phones, issuance opens as a near-full-height bottom sheet. The step header and primary action stay visible; only the body scrolls.
- Result groups stack. "View invoice" is a full-width row action on phones.

### Parent Portal

- Keep the existing outer `px-4 sm:px-6` and `max-w-4xl` container.
- Collection cards and invoice cards remain one column through `md`. At wider widths, Available to buy may use two columns, but an expanded chooser spans the full section width.
- Item rows stack at phone widths: checkbox and label first, unit price second, quantity controls and line total third. Quantity controls have 44 px touch targets.
- Confirmation metadata is a single definition list on phones and two columns from `sm`.
- Optional invoice rows place the checkbox and label on the first line and amount right-aligned on the second when space is tight.
- Sticky chooser actions may pin to the bottom viewport on phones, with safe-area padding. Do not cover payment instructions or browser controls.
- Convert Payment history to stacked rows below `sm`; retain the table at `sm` and above.

## Visual and component rules

- Preserve Public Sans for body copy, Space Grotesk for headings, and JetBrains Mono or tabular numerals for currency, invoice references, and quantities.
- Admin uses product-neutral white, slate, and current shadows. Use semantic amber, rose, and emerald only for warning, error, and success states.
- Parent primary buttons use `bg-brand-primary` with `text-brand-primary-contrast`; hover and focus use derived tenant tokens. Never place slate or white text on a tenant fill without the contrast token.
- Parent selected surfaces may use `brand-primary-surface` and its readable contrast token. Status badges remain semantic and do not inherit tenant colors.
- Standard radius is 12 px for controls and cards, 16 px for prominent groups. Avoid adding decorative gradients.
- Motion is limited to the existing 200 to 300 ms fade/slide for sheets and inline chooser expansion. Respect reduced motion. No animated totals.
- Every control has a persistent text label. Placeholder text never replaces a label.
- Checkboxes and quantity controls use native semantics. Use `fieldset` and `legend` for Eligible classes, Students, and Items.
- Error summaries use `role="alert"`; mutation success and total updates use `aria-live="polite"`.
- Focus returns to the trigger when a sheet or chooser closes. On validation, focus the first invalid field. On stale updates, focus the stale warning.
- Status and selection must never rely on color alone. Always pair color with text or an icon and accessible label.

## Contract mapping

| Interaction | G1 contract |
| --- | --- |
| Admin collection list and Show inactive | `billing.listSelectableBillingCollections({ includeInactive? })` |
| Admin create collection | `billing.createSelectableBillingCollection` |
| Admin single or multi-student issuance | `billing.issueSelectableBillingItems` |
| Admin optional fee-plan invoice edit | `billing.updateInvoiceOptionalSelections` |
| Parent Available to buy section | `portal.listEligibleSelectableBillingCollections` |
| Parent confirm selected collection items | `portal.createSelectableInvoice` |
| Parent optional fee-plan invoice edit | `portal.updateInvoiceOptionalSelections` |
| Parent invoice display and lock state | extended `portal.getBillingData` |
| Admin payment handoff after optional edit | `billing.initializeOnlinePayment` with current revision where required |
| Parent payment handoff after optional edit | `billing.initializePortalOnlinePayment` with current revision where required |

The UI must not add `schoolId` to new collection, issuance, or Portal mutation arguments. Authorization comes from authenticated membership and the selected accessible student.

## Frontend acceptance criteria

### Admin

- Selectable items is a separate, discoverable tab and never changes the meaning of Plans or Bulk Invoicing.
- Collection creation requires a name, one or more eligible classes, one or more unique named positive-price items, and a compatible optional bank account.
- No collection screen shows a receivable or outstanding amount.
- Issue items supports one or several active eligible students, one or several selected items, and positive integer quantities.
- Review shows only chosen items, the recipient count, and a positive estimated per-student total before calling one mutation.
- The result separates created, replayed, and skipped-existing recipients.
- Unknown issuance outcomes keep the same request key for an unchanged retry.
- Fee-plan optional-row copy shows initial mandatory total separately from optional availability.
- Admin optional-row edits send the current revision, replace local values with the response, and become read-only after a payment lock.

### Parent

- Available collections render separately from invoices and explicitly state that browsing does not change the balance.
- Student-role viewers see no purchase controls and can continue viewing existing invoices.
- Review and Create invoice stay disabled until at least one item has a valid quantity and positive total.
- No invoice or payment action occurs while browsing, selecting, or entering review.
- Confirmation states that an invoice will be created and that collection invoice items cannot be changed in this feature.
- Success or replay focuses the authoritative positive invoice and only then enables payment.
- Existing collection invoices display snapshot quantity, unit price, and extended amount without edit controls.
- Editable class-default optional rows show selected and unselected states, require an explicit Save choices action, and block Pay while dirty or saving.
- Stale updates discard local choices, refresh, and require review. They never auto-replay.
- Any payment allocation or positive amount paid switches optional rows permanently to read-only.
- Payment initialization uses the current saved revision and balance, never an estimated local total.

### Responsive and accessibility

- The complete Admin flow works in the 400 px desktop rail and a phone sheet without horizontal page scrolling.
- The complete Parent flow works at 320 px width with 44 px item, checkbox, quantity, and action targets.
- Tab overflow, long class names, long item names, four-digit quantities within the product limit, and large currency values do not hide required actions.
- Keyboard users can complete selection, review, save, and payment handoff in logical focus order.
- Screen readers receive field errors, stale warnings, invoice creation, and authoritative total updates.

## Builder constraints and residual risks

- B2 and B3 must read B1's generated types and exact error data before mapping errors. This specification does not authorize client-side substitutes for missing contract fields.
- The corrected architecture requires Admin invoice projections to expose optional editability comparable to Portal. If B1 returns only raw invoice rows to Admin, B2 needs an architect-approved projection rather than reimplementing the payment-allocation lock in the browser.
- A provider URL can become orphaned if the invoice changes during provider initialization. The UI only prevents presenting a stale URL; provider-side cancellation remains outside scope.
- A timeout after a successful create can leave the client uncertain until idempotent replay or refreshed invoice data resolves it. Keep the request key stable and make "Check invoices" available.
- Collection editing and archival are intentionally absent. Showing inactive collections does not imply those controls exist.
- Inventory, sizes, stock, suppliers, returns, and fulfilment remain out of scope. Avoid copy such as "in stock," "reserve," "order status," or "delivery."
