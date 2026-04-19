# Per-School Paystack Merchant Routing

## Goal

Upgrade school billing from a single deployment-level Paystack secret to a true per-school merchant model where each school can store and validate its own Paystack credentials, choose an active mode (`test` or `live`), and route payment initialization and webhook verification through the correct merchant context.

## Scope Boundary

This feature covers **school billing only**:

- school-owned Paystack credential storage
- school-admin merchant setup in the billing workspace
- active merchant mode selection (`test` vs `live`)
- school-aware payment initialization for admin and portal payment flows
- school-aware webhook verification and reconciliation
- masked merchant health visibility in the billing dashboard

It does **not** include:

- platform SaaS billing
- a generic provider marketplace
- custom pricing logic
- non-Paystack provider onboarding beyond the existing adapter boundary

## Architecture

## Data Model

### `schoolBillingSettings`

Extended with:

- `paymentProviderMode`

This field decides which school merchant mode is active for new payment initialization.

### `schoolPaymentProviders`

Stores non-secret provider state per school and mode.

Fields include:

- `schoolId`
- `provider`
- `mode`
- `isEnabled`
- `status`
- masked public/secret display metadata
- active and pending secret references
- validation timestamps/messages

This is the dashboard-facing metadata layer.

### `schoolPaymentProviderSecrets`

Stores encrypted secret material per school and mode.

Fields include:

- `schoolId`
- `provider`
- `mode`
- `encryptedSecret`
- `secretFingerprint`
- audit timestamps and user ids

This table is intentionally separate from the dashboard-facing provider metadata.

### Existing Billing Records Extended

The following records now also carry provider-mode context where relevant:

- `billingPaymentAttempts.providerMode`
- `paymentGatewayEvents.providerMode`

That preserves the merchant-mode context used for initialization and later reconciliation.

## Secret Protection Model

- Secret keys are encrypted before storage.
- The encryption key is read from `BILLING_PROVIDER_SECRET_ENCRYPTION_KEY`.
- Normal billing dashboard queries return only masked values and fingerprints.
- Raw secret keys are only decrypted inside tightly scoped internal Convex queries used for:
  - payment initialization
  - reference verification
  - webhook signature verification
  - connection validation

The admin UI never receives a raw secret value back after save.

## Payment Initialization Routing

When the admin or portal initializes a Paystack payment:

1. The invoice context is resolved for the current school.
2. The active provider mode is read from `schoolBillingSettings.paymentProviderMode`.
3. The matching school Paystack provider config is loaded.
4. The active secret for that school+mode is decrypted server-side.
5. The gateway adapter initializes the Paystack transaction with the correct merchant secret.
6. The resulting payment attempt stores the `providerMode` alongside the reference.

If the active merchant is not ready, payment initialization fails with a clear user-facing error.

## Return-Page Verification Boundary

- Admin return-page verification now runs only inside authenticated admin context.
- Portal return-page verification now runs only inside authenticated parent or student context tied to the invoice being verified.
- No public Convex action returns payer details or invoice balance data from a bare Paystack reference alone.

## Webhook Verification Routing

Per-school webhook verification uses a school-aware reference resolution strategy:

1. The webhook body is parsed without mutating any billing state.
2. The candidate payment reference is extracted from the payload.
3. The system resolves the reference back to a school invoice context using trusted billing references and fallback invoice metadata.
4. The matching school+mode merchant secret is loaded internally.
5. The Paystack signature is verified with that school-specific secret.
6. Only after signature verification succeeds does the system record the gateway event and attempt reconciliation.

This preserves the authenticity check while avoiding a global deployment secret.

## Admin Billing UX

The school admin billing workspace now supports:

- billing defaults and online-payment toggles
- active Paystack mode selection (`test` or `live`)
- saving per-mode public/secret credential drafts
- validating credentials before promoting them to active use
- masked state display for both test and live modes
- visible states such as:
  - not configured
  - invalid
  - ready
  - disabled
  - rotation pending

The front-desk payment-link flow is now blocked until the active merchant mode is ready.

## Operational Notes

### Validation

Credential validation uses the selected school+mode secret through the gateway adapter before the config is promoted to a ready state.

### Rotation

Saving a new secret moves the configuration into a pending/rotation state until validation succeeds.

### Disablement

Disabling online payments turns the effective state into `disabled` without mixing school billing with platform billing.

### Test/Live Separation

Test and live credentials are stored independently per school, and the active mode can be switched through school billing settings.

## Components

### Server

- `packages/convex/schema.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingGateway.ts`
- `packages/convex/functions/billingProviders.ts`
- `packages/convex/functions/billingShared.ts`
- `packages/convex/functions/billingWebhooks.ts`

### Client

- `apps/admin/app/billing/page.tsx`

## Regression Checks

- No school can initialize payments with another school's merchant secret.
- Raw secret keys are never returned in normal UI queries.
- Unknown or mismatched references fail safely during verification.
- Webhook verification no longer assumes one global Paystack secret.
- Billing remains separated from platform SaaS billing.

## Implemented Outcome

- Schools can now maintain their own Paystack merchant credentials.
- Schools can switch between test and live merchant modes.
- Admin and portal payment initialization route through the correct school-owned merchant.
- Webhook verification resolves the correct school-specific secret before reconciliation.
- The billing dashboard exposes masked merchant readiness without leaking secrets.
- Key rotation and validation states are represented explicitly in the current billing foundation.
