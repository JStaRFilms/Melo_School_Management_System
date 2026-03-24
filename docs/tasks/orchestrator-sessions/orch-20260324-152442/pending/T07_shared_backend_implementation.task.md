# T07 Shared Domain And Backend Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, `convex-functions`, `convex-schema-validator`, `convex-best-practices`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the shared domain and backend portion of Exam Recording v1.

## Scope

Included:
- shared types and calculation helpers
- assessment settings schema
- grading bands schema
- assessment record schema
- roster sheet query
- bulk upsert mutation
- role and school authorization
- tests for calculations and backend validation

Excluded:
- teacher app pages
- admin app pages

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/tasks/ExamRecording_SharedDomainAndBackend.md`
- `docs/Coding_Guidelines.md`

## Definition Of Done

- Backend behavior matches the sub-PRD.
- Derived values and snapshots are stored at write time.
- Targeted tests exist for scaling, validation, and authorization.

## Expected Artifacts

- Backend and shared-domain code in the appropriate app/package locations
- Tests covering the backend slice

## Constraints

- Respect the 200-line rule by splitting logic early.
- Run typecheck after TypeScript edits.
- Update docs only if behavior changes from the brief.

## Verification

- Confirm `/40` and `/60 -> /40` calculations pass tests.
- Confirm teacher assignment and admin override rules are enforced.
