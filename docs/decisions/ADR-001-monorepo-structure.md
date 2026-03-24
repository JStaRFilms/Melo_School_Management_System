# ADR-001: Monorepo Structure with pnpm Workspaces and Turborepo

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

The School Management System requires a structure that supports multiple web applications (public website, admin, teacher, portal) sharing common code while enabling independent deployment and development velocity.

## Decision

Use pnpm workspaces with Turborepo for monorepo management:
- **Root:** `package.json` with `"workspaces": ["apps/*", "packages/*"]`
- **Apps:** `apps/www`, `apps/admin`, `apps/teacher`, `apps/portal`
- **Packages:** Shared packages for UI, auth, types, utils, and convex functions
- **Build:** Turborepo for task orchestration, caching, and parallelization

## Rationale

1. **Shared Code:** Academic and billing domains need consistent types, validation, and utilities across all apps
2. **Deployment Flexibility:** Each app can be deployed independently to different hosts
3. **Developer Experience:** pnpm provides deterministic installs; Turborepo enables selective builds and remote caching
4. **Convex Integration:** Convex functions can live in a shared package, imported by all apps

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Single Next.js app with routes | Doesn't support distinct deployment per app; role-based routing creates complexity |
| Separate repos | Shared code duplication; coordinated releases difficult |
| Nx | Higher complexity; pnpm+turbo sufficient for our scale |
| Lerna | Deprecated; pnpm workspaces offer native monorepo support |

## Consequences

- All apps must follow workspace conventions (imports from `@school/shared/*`)
- CI/CD must be configured for monorepo (TurboRepo or GitHub Actions)
- Shared packages require careful versioning strategy
