# T19 Monorepo Scaffold

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `monorepo-management` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Scaffold the `pnpm` + `Turborepo` monorepo with the four app shells, shared packages, and root workspace configuration.

## Scope

Included: root workspace files, app folders, shared packages, turbo pipeline.  
Excluded: feature implementation.

## Context

This task establishes the physical repo layout that later tasks will build inside.

## Definition of Done

- Apps `www`, `admin`, `teacher`, and `portal` exist.
- Shared package shells exist.
- Root scripts run through turbo.

## Expected Artifacts

- Root workspace files
- `apps/*`
- `packages/*`

## Constraints

- Keep imports app-to-package, not app-to-app.
- Preserve white-label and future mobile extensibility.

## Verification

- Root install works.
- Basic workspace scripts resolve without broken package references.

