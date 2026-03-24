# T12 Convex Project Wiring And Codegen

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, `convex-functions`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Wire the monorepo to a real Convex project so teacher and admin apps can run against a live deployment instead of preview-mode data.

## Scope

Included:
- Convex project configuration for this monorepo layout
- real codegen and `_generated` output for the Convex package
- local dev workflow for `convex dev`
- env strategy for teacher/admin apps using `NEXT_PUBLIC_CONVEX_URL`
- removal or replacement of temporary local Convex shims where appropriate
- setup notes for safe secret handling

Excluded:
- production deployment hardening beyond local/live-dev wiring
- school data seeding itself
- auth feature work beyond consuming the identity flow from `T11`

## Context

Use:
- current `packages/convex` implementation
- current `apps/admin` and `apps/teacher` Convex providers/runtime checks
- existing orchestration verification notes from `T07-T09`

## Definition Of Done

- The repo can connect to a real Convex dev deployment.
- Real Convex-generated bindings exist and are used where appropriate.
- Teacher and admin apps can read the live deployment URL from local app env files.

## Expected Artifacts

- Convex project config files
- Updated Convex package/codegen outputs
- Any supporting script/docs needed to run live local dev

## Constraints

- Do not commit secrets or machine-specific credentials.
- Keep the monorepo workflow understandable for future agents.

## Verification

- Confirm `convex dev --once` or equivalent live setup succeeds.
- Confirm codegen completes against the real project.
- Confirm teacher/admin apps can enter live mode when envs are present.
