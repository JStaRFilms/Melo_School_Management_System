# T24 CI and Verification Harness

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `nextjs-standards` and `webapp-testing`.
- Do not use `context7`.

## Objective

Create the root verification harness covering typecheck, lint, build, and Cypress entry points so the repo has consistent release checks.

## Scope

Included: root scripts, turbo tasks, Cypress bootstrap, verification docs.  
Excluded: full test suite implementation.

## Context

This task supports `FR-018` and should be finished before feature delivery scales up.

## Definition of Done

- Root verification scripts exist.
- Cypress is wired for later critical-path coverage.
- Verification expectations are documented.

## Expected Artifacts

- root `package.json` scripts
- Cypress config and support scaffolding

## Constraints

- Keep commands runnable from repo root.
- Avoid premature CI-provider lock-in unless necessary.

## Verification

- Baseline `typecheck`, `lint`, and Cypress smoke wiring run without structural errors.

