# T14 School-Scoped Paystack Setup and Front-Desk Payments

## Status

Completed on `2026-04-13`.

## What Changed

1. Extended the Convex billing workflow so school admins can now upsert school-scoped billing settings, including:
   - invoice prefix
   - default currency
   - default due days
   - manual-payment toggle
   - online-payment toggle
2. Added a constrained direct-to-school Paystack routing model for the billing MVP:
   - the Paystack secret stays deployment-scoped
   - schoolId and invoice metadata are embedded in the checkout payload
   - webhook reconciliation resolves back to the correct school invoice
3. Hardened the online payment-link action so it only issues links when:
   - the school has online payments enabled
   - the invoice still has a balance due
   - the requested amount does not exceed the outstanding balance
4. Added invoice payment-link metadata support for school slug and invoice number so webhook reconciliation is easier to audit and debug.
5. Extended the admin billing page so staff can now:
   - configure school billing settings
   - generate a front-desk Paystack payment link for a selected invoice
   - copy or open the generated payment URL
   - view a QR-ready handoff panel for the payment link flow
6. Updated billing docs and task artifacts to reflect the implemented workflow and the chosen routing model.

## Files Updated

- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingGateway.ts`
- `apps/admin/app/billing/page.tsx`
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/decisions/ADR-005-payment-gateway.md`
- `docs/issues/FR-014.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T14_school_scoped_paystack_front_desk_payments.result.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T14_school_scoped_paystack_front_desk_payments.task.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅ after build regenerated `.next/types`

## Routing Model Chosen

**Direct-to-school Paystack routing with a shared deployment secret.**

This MVP keeps merchant orchestration simple and safe:

- the deployment owns the Paystack secret
- each payment link includes school and invoice metadata
- webhook processing resolves the payment back to the correct school invoice
- school billing is kept separate from platform SaaS billing

## Notes

- Parent self-serve portal billing remains out of scope for T14.
- The implementation intentionally avoids pretending per-school merchant orchestration is already solved.
- If per-school Paystack accounts become a later requirement, that should be handled as a follow-on architecture change rather than hidden inside this MVP.
