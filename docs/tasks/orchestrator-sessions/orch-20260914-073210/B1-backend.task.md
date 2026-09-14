# B1: Implement selectable billing backend

## Agent setup

Follow Vibe Build and the Backend role. Read first:

1. `packages/convex/_generated/ai/guidelines.md`
2. `docs/tasks/orchestrator-sessions/orch-20260914-073210/master_plan.md`
3. `docs/tasks/orchestrator-sessions/orch-20260914-073210/G1-architecture.result.md`
4. `docs/features/BillingAndPaymentsFoundation.md`
5. Existing billing, portal identity, bank instruction, duplication, purge, seed, and integration-test files named by G1

## Objective

Implement the authoritative data model and contracts for selectable billing collections, positive invoice creation, class eligibility, quantity snapshots, revisioned optional-item updates on existing meaningful invoices, and payment locking.

## Scope

- Update `docs/features/BillingAndPaymentsFoundation.md` before source changes.
- Add dedicated collection and item schema tables plus compatible invoice/source fields.
- Add shared validators, projections, calculations, and structured errors.
- Implement bounded Admin collection queries and creation.
- Implement idempotent Admin individual/multi-student issuance.
- Implement Parent eligible-collection query and atomic positive invoice creation.
- Implement revisioned Admin and Parent optional selection updates for existing invoices with compulsory value.
- Require current selection revision when generating payment links for revisioned invoices.
- Register new tables and references in branch duplication, tenant purge, and seed/reset paths.
- Add focused Convex integration tests.

## Authoritative rules

- Listing eligibility never writes an invoice.
- Invoice creation requires at least one selected item and total greater than zero.
- New collection invoices contain only committed item snapshots or otherwise preserve offered choices without creating zero debt, according to the corrected G1 contract.
- Legacy missing `isSelected` remains included.
- New fee-plan optional rows write explicit unselected state when parent-selectable while mandatory charges keep the invoice positive.
- Reject item selection changes after `amountPaid > 0` or any payment allocation.
- Recalculate subtotal, total, balance, status, and installments transactionally.
- Derive school and portal student access server-side and fail closed.

## Definition of done

- Exact G1 contracts exist with validators and bounded reads.
- Tenant, role, class, session/term, duplicate, stale-revision, and payment-lock checks pass.
- Persisted accounting totals exclude unselected options.
- Existing class-default invoicing and historical invoice totals remain compatible.
- Backend integration tests and Convex typecheck pass.

## Expected artifacts

- Updated feature documentation
- Schema and backend function changes
- Focused integration tests
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B1-backend.result.md`

## Verification

Run the narrowest relevant billing tests, Convex codegen, and `@school/convex` typecheck. Report exact commands and results. Do not deploy.

## Handoff

Return exact callable Admin and Parent contracts, success/error states, permission rules, files changed, and any migration requirement for B2 and B3.
