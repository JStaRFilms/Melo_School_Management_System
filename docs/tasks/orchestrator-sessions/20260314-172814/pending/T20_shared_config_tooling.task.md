# T20 Shared Config and Tooling

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `monorepo-management` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Set up shared TypeScript, ESLint, formatting, environment, and helper tooling packages that keep the monorepo consistent.

## Scope

Included: shared configs, root scripts, env conventions, developer tooling.  
Excluded: CI provider specifics if not required for local verification.

## Context

This task should make later app and package setup predictable and reduce duplicate config.

## Definition of Done

- Shared config packages exist and are consumed by apps.
- Root commands are consistent and documented.

## Expected Artifacts

- `packages/config`
- shared tsconfig/eslint settings
- root scripts

## Constraints

- Keep configuration simple enough for future agents to extend safely.

## Verification

- `pnpm typecheck` and `pnpm lint` resolve from root once baseline files exist.

