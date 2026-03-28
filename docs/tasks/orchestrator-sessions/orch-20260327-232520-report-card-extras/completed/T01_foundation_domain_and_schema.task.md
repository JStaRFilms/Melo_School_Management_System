# T01 Foundation Domain And Schema

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `nextjs-standards`, and any directly relevant Convex skills already available in the repo context.
- Do not begin until `T00` is approved by the user and marked complete by the orchestrator.

## Objective

Implement the backend/domain foundation for configurable report-card extras and student-name compatibility.

## Write Scope

- `packages/convex/schema.ts`
- new or updated files under `packages/convex/functions/academic/`
- shared type files only if required for backend contract alignment

## Responsibilities

- add tables for scale templates, bundles, class assignments, and per-student term values
- add first-name and last-name support with compatibility display name
- implement best-effort name backfill strategy
- extend report-card payload contract with printable extras data
- include Nursery support where domain/UI assumptions currently only allow Primary/Secondary

## Definition Of Done

- schema/type generation passes
- new queries/mutations cover bundle config, bundle assignment, extras entry, and report-card payload composition
- existing report-card and student flows remain type-compatible
- backfill path is automatic and safe for ambiguous names

## Constraints

- no formulas
- no conditional visibility rules
- no class-vs-level precedence engine
- keep modules split rather than overloading existing large files
