# T21 Convex Backend Skeleton

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-best-practices`, `convex-functions`, and `convex-schema-validator`.
- Do not use `context7`.

## Objective

Create the shared Convex backend structure, schema entry points, generated type flow, and domain-based folder organization.

## Scope

Included: `convex/` skeleton, schema shell, function organization, shared validators.  
Excluded: full business logic.

## Context

This is the one backend for all apps and must be school-aware from the start.

## Definition of Done

- Domain folders exist in `convex/`.
- Schema and generated types are wired.
- Conventions for public, internal, and HTTP actions are established.

## Expected Artifacts

- `convex/schema.ts`
- domain function files under `convex/`

## Constraints

- Organize by business domain, not technical layer.
- Keep validators explicit.

## Verification

- Convex codegen and type generation succeed.
- Folder structure supports later domain expansion cleanly.

