# T03 Cumulative Results UI and Printing

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use the Takomi continue-build flow after `T02` backend contracts are stable.

### Prime Agent Context
Read:

- `docs/features/CumulativeTermResultsAndBackfill.md`
- `apps/admin/app/assessments/report-cards/page.tsx`
- `apps/teacher/app/assessments/report-card-workbench/page.tsx`
- `packages/shared/src/components/ReportCardSheet.tsx`
- `packages/shared/src/components/ReportCardPrintStack.tsx`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `frontend-design` | Clear cumulative-results UX |
| `nextjs-standards` | App Router implementation |
| `sync-docs` | Keep docs aligned |

## Objective

Make cumulative annual reporting obvious, neat, and easy across admin review, teacher workbench visibility, and printable report cards.

## Scope

Included:

- admin-facing cumulative indicators and warnings
- teacher read-only cumulative annual summary when viewing third-term report cards
- printable report-card layout updates for annual average display
- clear missing-prior-data states

Excluded:

- prior-term backfill data entry itself
- portal-facing cumulative views

## Definition of Done

- cumulative annual values are visibly distinct from current-term totals
- missing prior-term data blocks ambiguous printing
- admin and teacher UX remain understandable on mobile and desktop

## Expected Artifacts

- updated admin report-card UI
- updated teacher workbench UI
- updated shared printable report-card components
- verification notes and docs sync

## Constraints

- keep teachers out of historical backfill entry
- do not bury annual-average logic behind confusing labels
