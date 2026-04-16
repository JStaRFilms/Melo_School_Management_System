# T15 Portal Billing and Self-Serve Payments

## Status

Completed on `2026-04-13`.

## What Changed

1. Extended the portal backend in `packages/convex/functions/portal.ts` with portal-safe billing access:
   - outstanding invoice visibility for accessible children only
   - payment history and receipt/status rows
   - portal-side invoice payment context resolution
2. Extended the billing domain in `packages/convex/functions/billing.ts` with a portal-safe online payment action:
   - reuses the existing school invoice Paystack link flow
   - enforces portal authorization and child/invoice scoping
   - launches checkout using the invoice balance due
3. Added portal billing UI in `apps/portal/app/(portal)/components/PortalWorkspace.tsx` and `apps/portal/app/(portal)/billing/page.tsx`:
   - outstanding balances
   - invoice cards with line items
   - payment history / receipt visibility
   - pay-now actions for eligible invoices
4. Added a public portal payment return flow:
   - `apps/portal/app/payments/paystack/return/page.tsx`
   - `apps/portal/app/payments/paystack/return/PaystackReturnClient.tsx`
   - verifies the Paystack reference programmatically after return
5. Updated shared navigation so Billing is now available inside the portal workspace.
6. Synced portal feature docs and task acceptance notes.

## Files Updated

- `packages/convex/functions/portal.ts`
- `packages/convex/functions/billing.ts`
- `apps/portal/app/(portal)/billing/page.tsx`
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
- `apps/portal/app/payments/paystack/return/page.tsx`
- `apps/portal/app/payments/paystack/return/PaystackReturnClient.tsx`
- `apps/portal/lib/portal-types.ts`
- `packages/shared/src/workspace-navigation.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`
- `docs/features/PortalAcademicPortalFoundation.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/pending/T15_portal_billing_and_self_serve_payments.task.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/portal build` ✅
- `pnpm --filter @school/portal exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅

## Notes

- A follow-up hardening task remains recorded as `T16` for cross-device reconciliation edge cases.
- The portal payment return flow now preserves child context back into portal billing after checkout.
