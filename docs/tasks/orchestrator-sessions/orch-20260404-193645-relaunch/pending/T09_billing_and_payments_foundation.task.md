# T09 Billing and Payments Foundation

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use the Takomi continue-build path after parent/family linking is in place.

### Prime Agent Context
Read:

- `docs/issues/FR-013.md`
- `docs/issues/FR-014.md`
- `docs/issues/FR-015.md`
- `docs/decisions/ADR-005-payment-gateway.md`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `convex-schema-validator` | Billing schema |
| `convex-http-actions` | Payment callbacks |
| `convex-security-check` | Signature and audit safety |
| `sync-docs` | Documentation accuracy |

## Objective

Lay the real billing and payment foundation that is still missing from the shipped system.

## Scope

Included:

- fee plans and invoice model
- manual payment capture foundation
- provider-agnostic online-payment adapter direction
- admin collections baseline

Excluded:

- full portal payment UX polish
- platform SaaS billing

## Definition of Done

- school billing exists as real code, not only PRD/docs
- payment and invoice data structures are stable enough for UI work
