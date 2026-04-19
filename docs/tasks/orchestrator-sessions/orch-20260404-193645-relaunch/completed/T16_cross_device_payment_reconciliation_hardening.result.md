# T16 Cross-Device Payment Reconciliation Hardening

## Status

Completed on `2026-04-17`.

## What Changed

1. Added a durable `billingPaymentAttempts` model in `packages/convex/schema.ts` and corresponding validators in `packages/convex/functions/billingShared.ts`.
2. Extended `packages/convex/functions/billing.ts` so online payment links now create auditable payment-attempt records that store:
   - reference and gateway reference
   - amount and currency
   - callback context
   - lifecycle status
   - last-checked / resolved timestamps
   - linked payment and gateway event ids when reconciliation succeeds
3. Added `reconcilePendingOnlinePayments` so the admin workspace can passively recheck pending Paystack references and keep cross-device payments moving even when the payer never completes the normal callback path.
4. Updated verified gateway-event handling so return-page, webhook, and admin-poll reconciliation paths all feed the same idempotent attempt lifecycle.
5. Updated the admin billing UI in `apps/admin/app/billing/page.tsx` to show:
   - payment-attempt lifecycle cards
   - pending / resolved / needs-review counts
   - manual recheck controls for pending references
   - clearer language around cross-device and skipped-return scenarios
6. Updated the admin Paystack return-page copy so staff know the background billing workspace can continue reconciliation even if the callback path is interrupted.
7. Synced billing docs and FR tracking with the new payment-attempt model and reconciliation behavior.

## Files Updated

- `packages/convex/schema.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingWebhooks.ts`
- `apps/admin/app/billing/page.tsx`
- `apps/admin/app/payments/paystack/return/PaystackReturnClient.tsx`
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/issues/FR-014.md`
- `docs/issues/FR-015.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T16_cross_device_payment_reconciliation_hardening.result.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T16_cross_device_payment_reconciliation_hardening.task.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/portal build` ✅
- `pnpm --filter @school/portal exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm lint` ✅ with the existing teacher-app React Hooks warning and recurring Next.js ESLint-plugin notices outside this slice
- `pnpm typecheck` ⚠️ turbo hit a transient `@school/platform` `.next/types` ordering issue during the parallel pipeline
- `pnpm --filter @school/platform build` ✅
- `pnpm --filter @school/platform exec tsc --noEmit -p tsconfig.json` ✅

## Notes

- The reconciliation hardening stays scoped to school-fee billing and does not introduce platform SaaS billing concerns.
- Repeated return-page checks, webhook deliveries, and admin rechecks continue to funnel through the same idempotent payment-allocation path.
- The admin polling path is a background fallback, not the primary operator workflow.
