# G1: Finalize selectable billing architecture

## Objective

Inspect the current billing backend, Admin billing workspace, Parent Portal billing flow, permissions, and focused tests. Return an implementation-ready architecture that satisfies the confirmed decisions in `master_plan.md` with the smallest compatible schema change.

## Scope

- `packages/convex/schema.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/portal.ts`
- relevant billing integration tests
- `apps/admin/app/billing/**`
- `apps/portal/app/(portal)/billing/**`
- `apps/portal/lib/portal-types.ts`
- `docs/features/BillingAndPaymentsFoundation.md`

## Required analysis

1. Map existing optional-line-item behavior and identify every calculation that assumes missing `isSelected` means selected.
2. Map the existing single-student invoice mutation and explain why the Admin UI cannot reach it.
3. Map Parent Portal invoice queries and payment-link creation.
4. Recommend whether selectable collections should extend `feePlans` or use dedicated tables, with migration and compatibility consequences.
5. Define exact public queries and mutations, their arguments, returns, capabilities, tenant checks, stale-write protection, and payment-lock behavior.
6. Define the smallest Admin and Parent UI changes that expose a complete path.
7. Identify focused tests and commands.

## Definition of done

- Recommendation handles separate class eligibility, individual/multi-student issuance, quantities, parent selection, accurate outstanding totals, snapshot history, and payment locking.
- Legacy invoices cannot silently change totals.
- Contracts fail closed across schools.
- Plan names exact files and functions to change.
- No source files are modified by this task.

## Expected artifact

Write the result to `docs/tasks/orchestrator-sessions/orch-20260914-073210/G1-architecture.result.md`.

## Review checkpoint

The orchestrator reviews the architecture and converts it into complete Design and Build task packets before implementation begins.
