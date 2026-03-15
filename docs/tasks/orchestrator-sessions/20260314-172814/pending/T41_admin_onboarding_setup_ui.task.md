# T41 Admin Onboarding and Setup UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the admin UI for school setup, role onboarding, user creation, and basic operational configuration.

## Scope

Included: school profile screens, people onboarding flows, membership assignment UI.  
Excluded: academics and finance-specific configuration screens already handled elsewhere.

## Context

This task fulfills the interface layer for `FR-003`.

## Definition of Done

- Admins can onboard staff, students, and parents through the UI.
- The flow aligns with the approved admin mockups.

## Expected Artifacts

- onboarding routes and components in `apps/admin`

## Constraints

- Support both create and invite patterns if the product direction requires them.
- Keep the UI efficient for repeated onboarding work.

## Verification

- Happy-path onboarding flows work for all primary role types.

