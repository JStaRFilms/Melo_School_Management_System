# T40 Parent Portal Payment UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement parent-facing billing and payment screens for invoices, balances, payment history, and online checkout initiation.

## Scope

Included: invoice summary screens, student balance views, checkout entry, payment history.  
Excluded: admin-side collections management.

## Context

This task completes the user-facing billing half of `FR-014` and `FR-015`.

## Definition of Done

- Parents can see balances for linked students.
- Parents can start online payment from the portal.
- Payment history is understandable and school-branded.

## Expected Artifacts

- billing and payment routes in `apps/portal`

## Constraints

- Keep the flow simple and confidence-building.
- Parents must only see their linked students’ financial records.

## Verification

- Linked-parent flows show correct invoices and payment status per student.

