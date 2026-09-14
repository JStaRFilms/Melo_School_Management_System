# B3: Build the Parent Portal selectable-items workflow

## Agent setup

Follow Vibe Build and the Frontend role. Read first:

1. `docs/tasks/orchestrator-sessions/orch-20260914-073210/master_plan.md`
2. `docs/tasks/orchestrator-sessions/orch-20260914-073210/G1-architecture.result.md`
3. `docs/tasks/orchestrator-sessions/orch-20260914-073210/D1-interaction-design.result.md`
4. `docs/tasks/orchestrator-sessions/orch-20260914-073210/B1-backend.result.md`
5. Parent billing files and types named in those results

## Objective

Let a parent browse collections available to a linked student, choose items and quantities, create a positive invoice, review its authoritative total, and then pay. Also expose revisioned optional-row choices on existing meaningful invoices before payment.

## Scope

- Show eligible collections separately from invoices so availability does not appear as debt.
- Support selecting a linked student, choosing at least one item, setting permitted quantities, reviewing, and confirming invoice creation.
- Show immutable quantity, unit price, and line total snapshots on created invoices.
- Support optional-row changes on existing eligible invoices before payment.
- Pass the current selection revision into payment-link creation where required.
- Make student-role accounts read-only for these controls.
- Handle loading, empty, validation, duplicate/idempotent retry, stale revision, permission, and payment-lock states.
- Add focused component tests.

## Constraints

- Use only B1 contracts and authoritative returned totals.
- Never create an invoice when the selection is empty or zero.
- Never let a client-supplied school, amount, or family link authorize the operation.
- Keep the existing portal layout and tenant theme system.
- Inventory and fulfilment remain out of scope.

## Definition of done

- Eligible collections do not affect outstanding totals.
- A linked parent can create a positive invoice from selected items.
- An unrelated parent or student-role account cannot mutate selections.
- Pay Now remains unavailable until the authoritative invoice exists and has a positive balance.
- Any payment locks further item changes with clear copy.
- Focused tests, Portal typecheck, Portal build, and theme audit pass.

## Expected artifacts

- Parent Portal billing components/types and focused tests
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B3-parent-portal.result.md`

## Review checkpoint

Verify selection, invoice creation, reactive refresh, and payment handoff as one user path.
