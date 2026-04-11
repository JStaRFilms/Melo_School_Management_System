# T04 Historical Backfill Workflow

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use the Takomi continue-build flow after `T02` establishes the data contract.

### Prime Agent Context
Read:

- `docs/features/CumulativeTermResultsAndBackfill.md`
- `apps/admin/app/assessments/report-cards/page.tsx`
- `packages/convex/functions/academic/reportCards.ts`
- outputs from `T02`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `frontend-design` | Clean backfill UX |
| `convex-functions` | Admin-only save flow |
| `nextjs-standards` | Route and form implementation |
| `sync-docs` | Blueprint updates |

## Objective

Build the admin-only workflow for entering prior-term totals for schools that joined mid-session or are missing historical term data.

## Scope

Included:

- admin-only backfill route or panel
- batch roster-style entry for prior-term total-only values
- validation for `0-100` totals
- audit metadata and overwrite safety
- clear connection from missing cumulative data to backfill action

Excluded:

- spreadsheet import automation beyond structured manual entry
- teacher access to backfill tools

## Definition of Done

- admins can enter or update historical term totals cleanly
- the workflow is obviously distinct from normal CA/exam score entry
- report-card cumulative calculations consume the backfilled totals correctly

## Expected Artifacts

- admin route and components
- backend save/query wiring
- targeted tests
- updated docs

## Constraints

- historical backfill must not mutate live term assessment rows
- maintain strict auditability
