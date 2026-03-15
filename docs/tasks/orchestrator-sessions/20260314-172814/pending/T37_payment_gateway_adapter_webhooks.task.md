# T37 Payment Gateway Adapter and Webhook Handling

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-http-actions` and `convex-security-check`.
- Do not use `context7`.

## Objective

Implement the provider-agnostic payment adapter layer and Paystack-first webhook handling for online payments.

## Scope

Included: gateway initialization, provider abstraction, callback verification, event persistence.  
Excluded: admin manual reconciliation UI.

## Context

This task fulfills the online-payment half of `FR-014`.

## Definition of Done

- Payment initialization and verification flows exist.
- Gateway events are stored and verified safely.
- Invoice updates happen only after trusted verification.

## Expected Artifacts

- payment adapter code
- webhook or HTTP action handlers
- `GatewayEvent` persistence

## Constraints

- Verify signatures before mutating billing records.
- Keep provider-specific logic isolated.

## Verification

- Simulated successful and failed webhook flows update records correctly and safely.

