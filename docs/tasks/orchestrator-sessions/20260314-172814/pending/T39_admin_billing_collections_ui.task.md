# T39 Admin Billing and Collections UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the admin-facing billing, invoicing, payment, and collections screens in the admin app.

## Scope

Included: fee-plan setup, invoice views, payment history, reconciliation lists, collection summaries.  
Excluded: parent payment checkout experience.

## Context

This task fulfills `FR-015` and depends on the billing and payment backend tasks.

## Definition of Done

- Admin billing screens align with the approved mockups.
- Collection status and payment histories are visible.
- Manual and online payment states are understandable.

## Expected Artifacts

- billing routes and components in `apps/admin`

## Constraints

- Keep finance-heavy screens usable on mobile.
- Respect role permissions for sensitive financial actions.

## Verification

- Admin users can browse invoice, payment, and reconciliation flows without broken state transitions.

