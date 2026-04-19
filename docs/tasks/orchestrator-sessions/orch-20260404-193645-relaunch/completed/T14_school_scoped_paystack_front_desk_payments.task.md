# T14 School-Scoped Paystack Setup and Front-Desk Payments

## Objective

Turn the existing billing gateway foundation into a real school-facing Paystack payment workflow that works at the front desk: the admin can configure online payments for the school, open an invoice, and hand the parent a payment link or QR code to complete on their phone.

## Requested Scope

- add school-scoped online-payment settings and setup UX for billing
- define how Paystack is configured per school or otherwise safely routed for multi-school use
- expose a real invoice payment action that creates a checkout link from the admin billing workflow
- generate a shareable payment link and QR-code handoff for front-desk use
- complete webhook handling for successful online invoice payments and reconcile them into invoice balances safely
- surface receipt/status feedback to the admin after payment completes
- preserve clean separation between school billing and future platform SaaS subscription billing

## Acceptance Criteria

- [x] A school admin can enable and configure Paystack-backed online payments for school invoices.
- [x] From an invoice, the admin can generate a payment link for the parent.
- [x] The admin can display or copy a QR/payment link for the parent to complete on their own device.
- [x] Successful Paystack callbacks update the right invoice and payment records safely.
- [x] Failed, duplicate, or invalid webhook events are handled defensively.
- [x] The implementation is safe for a multi-school deployment model and does not conflate school money with platform SaaS billing.

## Notes

- Keep this task focused on school-scoped gateway setup plus the admin/front-desk payment experience.
- Parent self-serve portal billing remains a separate follow-up task.
- The chosen multi-school money-routing model is documented as direct-to-school with a shared deployment Paystack secret.
