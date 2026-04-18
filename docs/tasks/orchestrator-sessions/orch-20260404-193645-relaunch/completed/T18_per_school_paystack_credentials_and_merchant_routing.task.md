# T18 Per-School Paystack Credential Management and Merchant Routing

## Objective

Upgrade the current school billing integration from a single deployment-level Paystack secret into a true per-school merchant model, where each school can connect and manage its own Paystack credentials safely and the platform routes payment initialization and webhook verification using the correct school's merchant configuration.

## Why This Exists

Current billing support already covers:
- school billing data structures
- school-specific invoice routing
- admin and portal payment-link generation
- Paystack verification and reconciliation

However, the current Paystack model is still an MVP:
- one deployment-scoped `PAYSTACK_SECRET_KEY`
- school/invoice metadata embedded in the payment payload
- shared-secret verification for every school

That means the platform can route invoices back to the correct school, but it does **not** yet support each school using its own Paystack merchant account and keys.

This task captures the full follow-up architecture needed for true school-owned Paystack onboarding.

## Scope Boundary

This task is about **school-specific Paystack merchant configuration** for school billing.

Included:
- secure per-school credential storage
- school admin merchant setup UI
- runtime provider selection by `schoolId`
- correct-secret webhook verification per school
- operational flows like validation, rotation, disablement, and failure states

Excluded:
- platform SaaS billing
- pricing/packaging strategy
- payment provider marketplace beyond the Paystack-first lane
- rewriting invoice rules or family billing models

## Design Requirements

### 1. Secure Merchant Credential Storage

Add a secure model for school-scoped payment credentials.

At minimum support:
- Paystack secret key
- Paystack public key if needed for future frontend usage
- environment/mode awareness (`test` vs `live`)
- merchant account status
- timestamps and audit metadata

Requirements:
- never expose raw secret keys back to normal school UI reads
- credentials must be encrypted or stored using an approved secrets pattern, not casually returned in Convex query payloads
- only tightly scoped server-side functions should ever access decrypted secrets
- key material should be rotatable without rewriting billing history

Recommended structures to consider:
- `schoolPaymentProviders`
- `schoolPaymentProviderSecrets`
- or another split that keeps display metadata separate from secret material

### 2. School Admin Setup Experience

Add school-admin UI in billing settings for Paystack setup.

Requested capabilities:
- enable/disable online payments for the school
- choose Paystack mode: test vs live
- enter and update school-specific Paystack credentials
- run connection validation before marking setup active
- show masked credential state, not raw values
- show setup health:
  - not configured
  - invalid
  - ready
  - disabled
  - rotation pending

The UX should make it obvious whether online payments are actually usable.

### 3. Runtime Merchant Routing by School

Change payment initialization so the system selects credentials by `schoolId`.

That means:
- admin billing pay-now must initialize with the current school's Paystack secret
- portal pay-now must initialize with the current school's Paystack secret
- no school should ever initialize against another school's credentials
- the provider adapter layer should stay clean enough for future providers

This is the core routing change.

### 4. Webhook Verification with the Correct Secret

Webhook verification must stop assuming one global Paystack secret.

The system needs a school-aware verification strategy.

That may require one of these patterns:
- school-specific webhook endpoints
- a school lookup hint in the webhook payload that is trustworthy enough to resolve the expected secret
- event pre-resolution using invoice/reference metadata before signature validation is finalized
- or another safe routing pattern that preserves authenticity guarantees

Requirements:
- signature verification must use the correct school's configured secret
- duplicate events must remain idempotent
- events with missing or mismatched school resolution must fail safely
- reconciliation must never cross school boundaries

This part needs deliberate architecture review and should not be implemented casually.

### 5. Operational Hardening

The merchant-management feature must handle real operational states.

Include:
- key rotation flow
- revalidation after credential updates
- test/live mode separation
- disabled merchant state
- invalid credential state
- missing webhook readiness state
- clear user-facing errors when a school tries to accept payments without a healthy gateway setup

Also consider:
- who can edit keys (school admin only? platform super admin override?)
- audit logging for credential updates
- safe redaction in logs and UI
- how failed validations are surfaced

## Suggested Subtasks

### T18A — Data Model and Secret Storage Foundation
- design and add school-scoped payment provider records
- separate secret material from display metadata
- add internal helpers for secure read/write/update access
- define masking/redaction behavior

### T18B — School Billing Setup UI
- add billing settings UI for Paystack merchant onboarding
- support test/live mode selection
- support credential validation and status display
- support disablement and key rotation entry points

### T18C — School-Aware Payment Initialization
- update billing gateway selection so admin and portal pay-now flows use the correct school's credentials
- preserve current invoice-scoped guardrails and amount validation

### T18D — School-Aware Webhook Verification and Routing
- implement a safe strategy for choosing the correct school secret at webhook time
- preserve idempotency and rejection behavior
- document routing assumptions clearly

### T18E — Operational and Audit Hardening
- add status reporting, audit logs, validation failure handling, and credential-rotation support
- ensure dangerous misconfigurations are understandable in UI

## Acceptance Criteria

- [ ] A school admin can connect that school's Paystack credentials without code changes.
- [ ] Secret keys are stored securely and never exposed back to normal UI reads.
- [ ] Admin billing payment initialization uses the correct school's configured Paystack account.
- [ ] Portal payment initialization uses the correct school's configured Paystack account.
- [ ] Webhook verification uses the correct school-specific secret rather than one global deployment secret.
- [ ] Duplicate, invalid, or cross-school events remain safely rejected or ignored.
- [ ] Schools can rotate keys and switch between test/live modes without corrupting billing history.
- [ ] Billing UI clearly shows configured, invalid, disabled, and ready states for online payments.
- [ ] The implementation remains fully separated from platform SaaS billing concerns.

## Risks / Architecture Notes

- This task changes a core payment trust boundary and should be reviewed carefully before build.
- Webhook verification with per-school secrets is the trickiest part and may require a new callback/webhook routing pattern.
- Avoid introducing a half-secure "store raw secret in plain school settings" shortcut.
- Keep provider abstraction clean enough that future Flutterwave/Stripe support is still possible.

## Recommended Implementation Order

1. Design secret storage and metadata records.
2. Implement internal secure helpers and validation logic.
3. Build school billing setup UI with masked states.
4. Update admin and portal payment initialization to use school-scoped credentials.
5. Redesign webhook verification/routing for school-specific secrets.
6. Add audit, rotation, and operational state handling.
7. Verify end-to-end in both test and live-like school configurations.

## Verification Expectations

When this task is eventually implemented, verification should include at least:
- one school with valid test credentials
- another school with different test credentials
- admin pay-now for both schools
- portal pay-now for both schools
- webhook verification using the correct secret per school
- invalid key handling
- rotated key handling
- disabled school gateway handling
- cross-school negative tests proving no credential leakage or wrong-account usage

## Notes

- Depends conceptually on the current T14/T15 billing/payment groundwork.
- This should remain a dedicated future billing architecture lane, not a casual patch on top of the current shared-secret MVP.
- Coordinate any pricing or monetization language with `T12`, but do not merge platform SaaS billing into this task.
