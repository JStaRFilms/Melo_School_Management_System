# T22 Auth and Membership Foundation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-best-practices`.
- Do not use `context7`.

## Objective

Implement the baseline auth and membership model using Better Auth with school-aware roles, active-school resolution, and default route selection.

## Scope

Included: auth package shell, membership schema, active-school logic, role-aware routing helpers.  
Excluded: polished onboarding UI.

## Context

This task underpins `FR-002` and later access rules for all apps.

## Definition of Done

- A person can map to school memberships and roles.
- Default route logic exists for admin, teacher, parent, and student contexts.

## Expected Artifacts

- `packages/auth`
- membership-related backend and app helpers

## Constraints

- Keep provider coupling localized.
- Preserve support for multi-role users.

## Verification

- Auth flows can resolve a user’s active school and landing route.

