# T16 Cross-Device Payment Reconciliation Hardening

## Objective

Harden the school billing payment flow so cross-device Paystack payments reconcile reliably even when the payer does not complete the normal callback return path and no webhook is available.

## Why This Exists

`T14` now supports a much better default flow:
- payment links are generated from admin billing
- the payer returns to a public Paystack return page
- that return page verifies the payment programmatically
- webhook reconciliation remains available as a background fallback

However, one edge case still remains for later hardening:
- the payer completes payment on another device
- the payer never reaches or completes the callback return page
- webhook delivery is absent, delayed, or not configured

In that scenario, reconciliation may still need an additional trigger. This task captures the follow-up work so it does not block the current billing/portal sequence.

## Requested Scope

- add a durable model for tracking newly generated online payment attempts as pending
- add passive reconciliation support for pending Paystack references from the admin side without making manual confirmation the primary workflow
- evaluate and implement one or both of these patterns:
  - lightweight pending-payment polling for outstanding references
  - a more durable callback/session token flow tied to a generated payment attempt
- make payment lifecycle states clearer in admin UI, especially:
  - link generated
  - awaiting payer return
  - verified
  - webhook reconciled
  - pending/manual attention needed
- keep the system idempotent so repeated verification attempts never double-record money
- preserve strict school scoping and invoice scoping for every reconciliation attempt

## Acceptance Criteria

- [ ] A cross-device payment can still reconcile automatically when the payer does not land back on the return page.
- [ ] Admin staff do not need to use manual confirmation as the normal operational workflow.
- [ ] Duplicate verification/polling/webhook signals do not create duplicate payments or allocations.
- [ ] Pending/verified/reconciled states are understandable in the billing workspace.
- [ ] The hardening remains scoped to school billing and does not introduce platform SaaS billing concerns.

## Notes

- This is a follow-up hardening slice, not a blocker for `T15`.
- Keep the current public return-page verification behavior intact.
- Keep webhook support as a valid background path, not the sole source of truth.
- Prefer low-disruption extensions over a billing rewrite.
