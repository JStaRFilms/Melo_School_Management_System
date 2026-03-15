# T36 Fee Model and Billing Schema

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-schema-validator` and `convex-functions`.
- Do not use `context7`.

## Objective

Implement the billing schema for fee plans, invoice generation, line items, waivers, discounts, installments, balances, and billing statuses.

## Scope

Included: `FeePlan`, `StudentInvoice`, invoice-state rules, balance calculation helpers.  
Excluded: gateway callbacks and UI surfaces.

## Context

This task fulfills `FR-013` and lays the data contracts for the payment tasks that follow.

## Definition of Done

- Fee-plan and invoice data structures exist.
- Installment and balance logic is modeled clearly.
- Shared types match the approved public interfaces.

## Expected Artifacts

- Convex billing schema
- shared payment and invoice types in packages

## Constraints

- Keep the model provider-agnostic.
- Preserve historical invoice integrity after payments are recorded.

## Verification

- Schema supports term-based invoices, partial payments, waivers, and remaining balance calculations.

