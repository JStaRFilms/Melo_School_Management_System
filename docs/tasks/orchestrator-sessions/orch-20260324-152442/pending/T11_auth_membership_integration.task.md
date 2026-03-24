# T11 Auth And Membership Integration

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the minimum Better Auth and school-membership integration required for teacher and admin apps to make authenticated Convex requests against the live exam-recording backend.

## Scope

Included:
- Better Auth baseline wiring for admin and teacher apps
- session resolution and authenticated app guards
- Convex auth bridge so `ctx.auth.getUserIdentity()` receives a real identity
- user lookup alignment with `users.authId`
- role-aware workspace access for admin and teacher
- minimal sign-in flow or stub entry point needed for local live testing

Excluded:
- parent/student portal auth flows
- password reset, email verification, social login, or invite polish
- non-exam feature access controls beyond what is needed for local live testing

## Context

Use:
- `docs/decisions/ADR-003-auth-baseline.md`
- `docs/issues/FR-002.md`
- `docs/tasks/orchestrator-sessions/20260314-172814/pending/T22_auth_membership_foundation.task.md`
- current exam-recording implementation in `apps/admin`, `apps/teacher`, and `packages/convex`

## Definition Of Done

- Admin and teacher apps can reach live Convex functions with authenticated identities.
- `users.authId` is the lookup key used to resolve school membership and role.
- Unauthenticated users are blocked from protected screens.

## Expected Artifacts

- Auth config and session wiring in the relevant apps/packages
- Route or middleware protection for admin and teacher surfaces
- Minimal local sign-in path for live testing

## Constraints

- Keep the implementation minimal and production-safe.
- Do not add broad auth product scope beyond what live Convex testing needs now.

## Verification

- Confirm signed-in admin users can access admin exam-recording pages.
- Confirm signed-in teacher users can access teacher exam-entry pages.
- Confirm unauthenticated access is blocked.
- Confirm live Convex queries no longer fail with `Unauthorized` when signed in.
