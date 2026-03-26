# Full Class Report Card Printing

## Goal

Add a clear `Print Full Class` action to the class report-card screen so admins and teachers can print every student report card in the selected class, session, and term in one run.

## Why This Feature Exists

The current class-level batch flow improved navigation:

- jump to any student
- move with previous/next
- print one student at a time

That is much better than reopening report cards individually, but it still falls short of the earlier Excel-style workflow where staff could print the whole class in one go once results were ready.

## Scope

### In Scope

- `Print Full Class` action on admin report-card screen
- `Print Full Class` action on teacher report-card screen
- full-class report-card query in Convex
- print-ready stacked rendering of all student report cards for the selected class
- automatic return to normal single-student view after the print dialog closes

### Out Of Scope

- background PDF generation
- downloadable zip or per-student file generation
- multi-class print jobs
- custom print ordering beyond the class roster order

## Components

### Client

- extend the shared batch navigator to expose a prominent `Print Full Class` action
- update admin and teacher report-card pages to:
  - enter full-class print mode
  - fetch all report cards for the selected class
  - render a print-only stack
  - trigger browser print once ready

### Shared UI

- extend `ReportCardSheet` to support stack rendering without repeated on-screen toolbars
- add a report-card print-stack component that renders one page per student

### Server

- extend `packages/convex/functions/academic/reportCards.ts`
  - add `getClassReportCards`
  - reuse the existing single-student report-card composition rules
  - enforce the same admin/teacher access rules for the selected class

## Data Flow

### 1. Start Full-Class Print

1. User opens a student report card inside a class run.
2. User clicks `Print Full Class`.
3. Client switches the report-card page into class-print mode for the selected class/session/term.
4. Client requests the full class report-card stack from Convex.

### 2. Prepare Stack

1. Server validates class/session/term access.
2. Server loads the ordered class roster for the selected session.
3. Server builds a report-card payload for each student in the roster.
4. Client renders the stacked print view with one report card per page.

### 3. Print And Return

1. Once the stack is ready, the browser print dialog opens.
2. After printing or cancelling, client removes the print-mode flag and returns to the normal single-student class view.

## Error Handling

### Full-Class Print Errors

- class not found
- session not found
- term not found
- unauthorized teacher access
- no students found for selected class/session
- one or more student report cards failed to compose
- print stack not ready yet

## Acceptance Targets

- Admin can click `Print Full Class` from the class report-card screen
- Teacher can click `Print Full Class` for classes they are allowed to view
- the print dialog opens with the full class stack once data is ready
- each student report card prints on its own page
- after print closes, the user returns to the normal class report-card screen

## Implementation Notes

### Backend

- `packages/convex/functions/academic/reportCards.ts` now exposes:
  - `getClassReportCards`
  - shared class-access validation for report-card batch flows
  - a shared student report-card builder used by both single-student and full-class queries
- the full-class query reuses the same report-card composition rules as single-student export so comments, next-term date, student photo, and school logo stay consistent

### Shared UI

- `ReportCardBatchNavigator` now includes a clear `Print Full Class` action
- `ReportCardSheet` now supports `hideToolbar` so stacked print runs do not repeat the screen toolbar on every sheet
- `ReportCardPrintStack` now renders one report card per page using print page breaks

### Admin And Teacher Pages

- both report-card pages now support `printClass=1` mode
- when full-class print mode is active:
  - the page loads the full class stack
  - opens the browser print dialog automatically once ready
  - returns to the normal report-card view after the dialog closes
- the existing class-aware report-card links continue to work and now feed the full-class print flow directly

## Verification

- `convex dev --once --typecheck enable`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
