# Selectable billing items master plan

## Outcome

Add school-configurable selectable item collections for uniforms, books, transport, and similar extras while preserving class-default fee plans for compulsory charges.

The complete path must work in both Admin and Parent Portal:

- Admin can create a selectable collection and restrict it to eligible classes.
- Admin can issue selected items and quantities to one or more eligible students.
- Parent can choose among optional items on an unpaid invoice and see the total update before opening a payment link.
- Optional items do not count as outstanding until selected.
- Any payment locks optional-item selection.
- Invoice history retains item names and prices as snapshots.

## Confirmed product decisions

1. Compulsory class fees remain in the existing class-default plan and bulk-invoicing flow.
2. Uniforms, books, transport, and similar purchases use a separate selectable-items workflow.
3. Class assignment means eligibility. It does not automatically create debt.
4. Optional items start unselected and do not contribute to invoice totals or outstanding balances.
5. Parents and authorized Admin users may change optional selections only before the first payment.
6. Once `amountPaid > 0` or a payment allocation exists, item selection is locked.
7. Different uniform sets are separate school-configured collections assigned to the relevant classes. This is generic billing functionality, not a hard-coded Uniform module.
8. Inventory, stock counts, suppliers, sizes, returns, and fulfilment tracking are outside this feature.
9. Existing invoices and class-default plans must remain compatible.

## Task table

| ID | Stage | Owner | Purpose | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| G1 | Genesis | Architect | Finalize schema, API, compatibility, and security plan | None | Completed |
| D1 | Design | Designer | Specify Admin and Parent Portal interaction flows | G1 | Completed |
| B1 | Build | Coder | Implement backend model, contracts, docs, and integration tests | G1 | Completed |
| B2 | Build | Coder | Implement Admin collection and issue-items workflow | B1, D1 | Completed |
| B3 | Build | Coder | Implement Parent Portal browse, select, and pay workflow | B1, D1 | Completed |
| B4 | Build | Coder | Run cross-app verification and repair confirmed integration defects | B2, B3 | Completed |
| R1 | Build | Reviewer | Review accounting, authorization, compatibility, and user paths | B4 | Completed |

## Delivery order

### Genesis

- Inspect current billing and portal contracts, tests, permissions, and data assumptions.
- Produce a precise schema/API compatibility plan.
- Update the billing feature document before implementation because this changes persistent billing data flow.

### Design

- Define the Admin collection setup and issuing journeys.
- Define the Parent Portal selection and payment journey.
- Cover loading, empty, permission, validation, lock, and stale-update states.

### Build

1. Implement authoritative backend data and mutations.
2. Add focused Convex integration tests for totals, eligibility, tenant isolation, and payment locking.
3. Build the Admin setup and issue-items UI.
4. Build the Parent Portal optional-item selection UI.
5. Verify that payment links use the committed balance and that dashboard outstanding totals exclude unselected items.
6. Run focused tests, Convex codegen/typecheck, Admin typecheck/build, Portal typecheck/build, and the theme audit for touched school-facing files.
7. Perform one focused review pass and fix only confirmed blocking defects.

## Accounting invariants

- A selectable item creates no receivable merely because a student is eligible.
- Invoice `subtotal`, `totalAmount`, `balanceDue`, status, installments, and dashboard aggregates derive only from compulsory and selected optional line items.
- Selection changes are transactional and recalculate every dependent invoice amount.
- A generated payment link must never exceed the current committed invoice balance.
- A payment freezes the charge composition. Corrections after payment use controlled billing adjustments rather than toggling optional items.
- Every public operation derives the school and actor from authenticated membership and fails closed across tenants.

## Compatibility strategy

- Treat legacy optional invoice items with missing `isSelected` according to their existing invoiced state so old balances do not change during deployment.
- New selectable-item invoices write explicit `isSelected` values.
- Preserve immutable line-item snapshots on invoices even when the source collection later changes.
- Avoid rewriting historical invoices during normal reads.

## Expected artifacts

- Updated `docs/features/BillingAndPaymentsFoundation.md`
- Convex schema and billing/portal contracts
- Focused Convex integration tests
- Admin billing collection and issuance UI
- Parent Portal billing selection UI
- Session task packets and completion notes

## Definition of done

- A school can configure different selectable collections for different classes without hard-coded uniform rules.
- Admin can issue only chosen items to an individual or selected students.
- A parent can change optional selections on an unpaid invoice and immediately see the authoritative total.
- Selection is rejected after any payment.
- Unselected optional items never inflate outstanding balances.
- Existing compulsory bulk invoicing continues to work.
- Relevant checks pass and a reviewer finds no confirmed blocking regression.
