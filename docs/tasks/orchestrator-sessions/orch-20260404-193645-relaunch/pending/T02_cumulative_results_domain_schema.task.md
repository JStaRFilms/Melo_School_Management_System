# T02 Cumulative Results Domain and Schema

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use the Takomi continue-build path with blueprint-first discipline.

### Prime Agent Context
Read:

- `docs/Project_Requirements.md`
- `docs/features/CumulativeTermResultsAndBackfill.md`
- `docs/features/ExamRecording.md`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/assessmentRecords.ts`
- `packages/convex/functions/academic/reportCards.ts`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `convex-schema-validator` | Safe schema changes |
| `convex-functions` | Query and mutation design |
| `convex-best-practices` | Tenancy and auditability |
| `sync-docs` | Keep blueprint in sync |

## Objective

Implement the backend and schema support for third-term cumulative annual results without corrupting the existing per-term assessment workflow.

## Scope

Included:

- schema additions for historical prior-term totals
- backend functions for storing and reading prior-term total snapshots
- cumulative annual calculation helpers
- report-card backend support for third-term annual average calculation

Excluded:

- final admin/teacher UX
- portal delivery
- ranking, CGPA, or positions beyond this annual average use case

## Definition of Done

- historical prior-term totals have a clean, auditable schema
- third-term report-card queries can resolve first-, second-, and third-term totals
- cumulative grade and remark derive from the annual average
- normal term-only report-card behavior remains intact where cumulative mode is not enabled

## Expected Artifacts

- schema updates
- new academic backend module(s)
- shared calculation helpers and tests
- updated feature docs

## Constraints

- do not fake missing CA or exam component values for prior terms
- preserve school scoping and admin-only backfill writes
