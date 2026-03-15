# T09 ADR Pack for Core Architecture

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-genesis`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-genesis`.
- Run `/vibe-primeAgent`.
- Load `monorepo-management` and `convex-best-practices`.
- Do not use `context7`.

## Objective

Write architecture decision records for monorepo structure, auth baseline, tenancy model, app split, and payment direction.

## Scope

Included: ADRs for major structural decisions and tradeoffs.  
Excluded: low-level implementation ADRs for every feature.

## Context

These decisions are already chosen conceptually and need durable written records for future agents.

## Definition of Done

- Decision records exist for monorepo, apps, auth, tenancy, and payments.
- Each ADR explains chosen direction and rejected alternatives.

## Expected Artifacts

- ADR docs under `docs/features/` or a dedicated ADR location if introduced consistently

## Constraints

- Keep ADRs short and durable.
- Do not re-open settled decisions unless the repo state proves they are blocked.

## Verification

- Confirm Better Auth, one Convex backend, and Paystack-first adapter direction are documented.

