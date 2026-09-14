# D1: Design selectable billing interactions

## Agent setup

Follow Vibe Design. Read first:

1. `docs/tasks/orchestrator-sessions/orch-20260914-073210/master_plan.md`
2. `docs/tasks/orchestrator-sessions/orch-20260914-073210/G1-architecture.result.md`
3. `docs/features/BillingAndPaymentsFoundation.md`
4. Current Admin billing components under `apps/admin/app/billing/`
5. Current Parent Portal billing UI in `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`

Use the existing design system. Do not change application code.

## Objective

Produce build-ready interaction direction for school-configurable selectable item collections, Admin item issuance, and Parent Portal selection/payment.

## Scope

- Admin `/billing` collection list and create form
- Admin issue-items flow for one or several students
- Parent Portal eligible-collections area
- Parent selection, confirmation, invoice creation, and payment handoff
- Existing compulsory invoice optional-row editing before payment
- Responsive, loading, empty, validation, stale, permission, and payment-lock states

## Constraints

- Do not hard-code uniforms as a product type.
- Browsing an eligible collection creates no invoice or outstanding balance.
- Invoice creation requires at least one selected item and a positive total.
- Parents may select for linked students, not through student-role accounts.
- Existing visual hierarchy and tenant theme rules apply.
- Inventory, sizes, stock, returns, and fulfilment are out of scope.

## Definition of done

- Every interaction maps to a contract from G1.
- Admin and Parent flows are discoverable without crowding the current billing workspace.
- Error and locked states tell the user what happened and what they can do.
- Mobile behavior is explicit.
- The design does not imply that eligibility is debt.

## Expected artifact

Write `docs/tasks/orchestrator-sessions/orch-20260914-073210/D1-interaction-design.result.md` with annotated text wireframes, field order, button labels, state copy, and frontend acceptance criteria.

## Review checkpoint

The orchestrator checks contract alignment and uses the result as the frontend implementation specification.
