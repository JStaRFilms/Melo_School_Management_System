# B2: Build the Admin selectable-items workflow

## Agent setup

Follow Vibe Build and the Frontend role. Read first:

1. `docs/tasks/orchestrator-sessions/orch-20260914-073210/master_plan.md`
2. `docs/tasks/orchestrator-sessions/orch-20260914-073210/G1-architecture.result.md`
3. `docs/tasks/orchestrator-sessions/orch-20260914-073210/D1-interaction-design.result.md`
4. `docs/tasks/orchestrator-sessions/orch-20260914-073210/B1-backend.result.md`
5. Existing Admin billing files under `apps/admin/app/billing/`

## Objective

Expose the completed backend through the smallest coherent Admin UI for collection setup, class eligibility, individual/multi-student item issuance, and pre-payment optional-item adjustment.

## Scope

- Add a discoverable selectable-items area without disrupting compulsory Plans and Bulk Invoicing.
- Create collections with name, description, currency, eligible classes, optional settlement account, item names, categories, and unit prices.
- Issue one collection to one or several eligible students with selected items and quantities.
- Show created, replayed, and skipped-existing results.
- Allow authorized Admin users to adjust optional rows on eligible unpaid invoices using revisioned batch updates.
- Remove creation controls that misleadingly put new optional products into compulsory fee plans, while preserving display of legacy optional rows.
- Add focused component tests for validation and critical states.

## Constraints

- Use only B1 contracts. Do not weaken authorization or invent client-only accounting.
- Do not add inventory, sizes, suppliers, returns, or fulfilment.
- Do not create zero-value invoices.
- Preserve responsive behavior and existing design-system patterns.
- Use tenant theme tokens according to repository rules.

## Definition of done

- A bursar can configure different item collections for different classes.
- A bursar can issue selected quantities to one or several students.
- Totals shown after issuing come from the backend result.
- Duplicate, stale, eligibility, and payment-lock states have useful feedback.
- Existing compulsory fee-plan and bulk-invoicing flows still work.
- Focused tests, Admin typecheck, Admin build, and theme audit pass.

## Expected artifacts

- Admin billing components, hooks, types, and focused tests
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B2-admin-ui.result.md`

## Review checkpoint

Verify the complete Admin path against a real backend result and inspect the resulting invoice through the dashboard read path.
