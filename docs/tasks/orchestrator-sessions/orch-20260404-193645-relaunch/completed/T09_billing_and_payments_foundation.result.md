# T09 Billing and Payments Foundation

## Status

Completed on `2026-04-12`.

## What Changed

1. Added a real school-billing domain in Convex with school-scoped tables for:
   - billing settings
   - fee plans
   - student invoices
   - billing payments
   - payment allocations
   - gateway events
2. Implemented school-billing domain logic in `packages/convex/functions/billing.ts` for:
   - billing dashboard queries
   - fee-plan creation
   - invoice generation from fee plans
   - manual payment recording
   - invoice balance and status updates
   - online payment initialization
   - verified gateway-event persistence
3. Added payment helper modules:
   - `packages/convex/functions/billingShared.ts`
   - `packages/convex/functions/billingGateway.ts`
   - `packages/convex/functions/billingWebhooks.ts`
4. Registered the provider-agnostic payment webhook route in `packages/convex/http.ts` with Paystack-first signature verification.
5. Added an admin billing workspace at `apps/admin/app/billing/page.tsx` with:
   - summary metrics
   - fee-plan creation
   - invoice creation
   - manual payment capture
   - collections filtering by class, term, status, and search text
6. Added Billing to the shared admin workspace navigation.
7. Synced the rollout docs and FR tracking:
   - `docs/features/BillingAndPaymentsFoundation.md`
   - `docs/features/UnifiedWorkspaceNavbar.md`
   - `docs/issues/FR-013.md`
   - `docs/issues/FR-014.md`
   - `docs/issues/FR-015.md`

## Files Updated

- `packages/convex/schema.ts`
- `packages/convex/http.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingGateway.ts`
- `packages/convex/functions/billingWebhooks.ts`
- `packages/convex/_generated/api.d.ts`
- `apps/admin/app/billing/page.tsx`
- `packages/shared/src/workspace-navigation.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/features/UnifiedWorkspaceNavbar.md`
- `docs/issues/FR-013.md`
- `docs/issues/FR-014.md`
- `docs/issues/FR-015.md`

## Verification Run

- `pnpm convex:codegen` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin lint` ✅
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅ after build regenerated `.next/types`

## Notes

- This task stays strictly within school billing. Platform SaaS subscription billing remains a separate future concern.
- Paystack is implemented as the first provider behind a provider-agnostic adapter shape.
- The billing dashboard is a real foundation, but parent-facing payment UX, refunds, and deeper reconciliation workflows remain future slices.
