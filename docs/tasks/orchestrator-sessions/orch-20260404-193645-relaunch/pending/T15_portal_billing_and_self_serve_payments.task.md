# T15 Portal Billing and Self-Serve Payments

## Objective

Extend the student/parent portal so parents can log in and manage the financial side of school operations alongside academics: see outstanding fees, view payment history and receipts, and complete online payments themselves.

## Requested Scope

- add billing visibility to the portal workspace
- show outstanding invoices, balances, and payment status for the active child or household context
- show payment history and receipt visibility appropriate for parent/student portal users
- add a self-serve pay-now flow that launches the school invoice checkout experience
- keep portal permissions safe so parents only see the correct children and invoices
- preserve the existing academic portal areas while adding the finance layer in a clean UX

## Acceptance Criteria

- [x] A parent can log in and see outstanding fees for the correct student(s).
- [x] A parent can review prior payments and receipt/status details.
- [x] A parent can launch an online payment for an eligible invoice from the portal.
- [x] Successful payments are reflected in both the portal and admin billing workspace.
- [x] Portal billing data remains school-scoped, student-safe, and permission-aware.
- [x] The portal UX keeps grades/results/notifications intact while adding finance visibility clearly.

## Notes

- Depends on the online-payment groundwork from `T14`.
- Keep this task focused on portal UX and permission-safe billing visibility, not on school billing rules or platform SaaS subscriptions.
