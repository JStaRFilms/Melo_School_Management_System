# T18 Per-School Paystack Credential Management and Merchant Routing

## Status

Completed on `2026-04-17`.

## What Changed

1. Added a school-scoped Paystack merchant model with separate provider metadata and encrypted secret storage.
2. Extended school billing settings with an active payment-provider mode (`test` or `live`).
3. Added internal provider helpers for:
   - masked provider overview reads
   - secure secret resolution
   - payment-reference resolution
   - credential save / validation / promotion flows
4. Updated admin and portal payment initialization so the correct school-owned merchant secret is selected by `schoolId` and active mode.
5. Updated webhook verification so the system resolves the school invoice/payment context first, then verifies the signature with the correct school-specific secret instead of one deployment-wide secret.
6. Added billing admin UI for:
   - active mode selection
   - masked per-mode credential state
   - saving credential drafts
   - validating credentials
7. Updated billing docs and FR notes so the per-school merchant model is recorded clearly.

## Files Updated

### Convex / Backend
- `packages/convex/schema.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingGateway.ts`
- `packages/convex/functions/billingProviders.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingWebhooks.ts`
- `packages/convex/functions/portal.ts`

### Admin UI
- `apps/admin/app/billing/page.tsx`

### Docs / Session
- `docs/features/BillingAndPaymentsFoundation.md`
- `docs/features/PerSchoolPaystackMerchantRouting.md`
- `docs/issues/FR-014.md`
- `docs/issues/FR-015.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T18_per_school_paystack_credentials_and_merchant_routing.result.md`

## Final Merchant-Routing Architecture

- `schoolBillingSettings.paymentProviderMode` selects the active merchant mode for the school.
- `schoolPaymentProviders` stores non-secret provider state and masked status per school+mode.
- `schoolPaymentProviderSecrets` stores encrypted secret material per school+mode.
- Payment initialization resolves:
  1. invoice context
  2. school
  3. active mode
  4. school-specific secret
- Payment attempts and gateway events now preserve `providerMode` so later verification and reconciliation stay bound to the correct merchant context.
- Webhook verification pre-resolves the payment/invoice context from the payment reference and invoice metadata, then verifies the signature with the correct school-specific secret before any billing mutation occurs.

## Secret Protection Model

- Secret keys are encrypted before storage.
- The encryption key comes from `BILLING_PROVIDER_SECRET_ENCRYPTION_KEY`.
- Normal billing queries return only masked/fingerprint-style provider state.
- Raw secret values are only decrypted inside internal server-side queries used for initialization, verification, and validation.

## Verification Run

### Convex
- `pnpm --filter @school/convex typecheck` ✅
- `pnpm --filter @school/convex lint` ✅

### Admin
- `pnpm --filter @school/admin build` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin lint` ✅

### Portal
- `pnpm --filter @school/portal build` ✅
- `pnpm --filter @school/portal exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/portal lint` ✅

## Deferred

- richer provider-agnostic marketplace UI beyond Paystack
- stronger global invoice-number indexing if invoice-number-only fallback lookup needs to scale further
- dedicated audit-log table for merchant credential changes beyond current record timestamps and user ids
- school-admin self-serve secret rotation UX beyond the current save + validate workflow

## Notes

- No platform SaaS billing changes were made.
- School billing remains fully separated from platform SaaS billing.
- The per-school Paystack merchant model replaces the old deployment-secret assumption for school collections.
