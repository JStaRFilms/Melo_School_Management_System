# T23 Permissions and Support-Panel Rules

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-security-check` and `convex-functions`.
- Do not use `context7`.

## Objective

Define the permission matrix and implement read-only admin support-panel behavior for sensitive role-based screens.

## Scope

Included: permission helpers, support-view rules, school boundary enforcement.  
Excluded: deep audit tooling.

## Context

Security-sensitive flows must be locked before academic, billing, and portal features depend on them.

## Definition of Done

- Role and school checks are centralized.
- Support panels are explicitly read-only.
- Sensitive routes have guard helpers.

## Expected Artifacts

- `packages/permissions`
- permission utilities and backend checks

## Constraints

- Do not introduce impersonation.
- Keep checks composable across apps and backend functions.

## Verification

- Unauthorized access paths are denied in both UI guards and backend handlers.

