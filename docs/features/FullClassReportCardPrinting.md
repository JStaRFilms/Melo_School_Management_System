# Full Class Report Card Printing

## Goal

Add a clear `Print Full Class` action to the class report-card screen so admins and teachers can print every student report card in the selected class, session, and term in one run.

## Canonical Boundary

This document owns the batch-print entry flow, query behavior, and print lifecycle for admin and teacher report-card pages.

- For the shared preview and print rendering architecture, use `docs/features/UnifiedReportCardPrintSystem.md` as the source of truth.
- If this document and the unified print doc disagree about toolbar placement, scaling, or print CSS, the unified print doc wins.

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
- `ReportCardBatchPrintStackV2` renders one report card per page using the shared `ReportCardSheet`, but owns batch-only print CSS so the single-student print path remains untouched
- on-screen scaling belongs to `ReportCardPreview`, while print CSS in `ReportCardSheet` removes preview transforms and renders each sheet at full A4 size
- single-student toolbars stay outside `ReportCardSheet`, so stacked print output does not duplicate surface controls

### Admin And Teacher Pages

- both report-card pages now support `printClass=1` mode
- both report-card pages use the batch-only `ReportCardBatchPrintStackV2` for class printing, leaving the single-student `ReportCardPreview` / `ReportCardToolbar` path intact
- both report-card pages wrap their search-parameter-driven client content in `Suspense` so Next.js App Router production builds can prerender the route safely
- when full-class print mode is active:
  - the page loads the full class stack
  - opens the browser print dialog automatically once ready
  - returns to the normal report-card view after the dialog closes
- the existing class-aware report-card links continue to work and now feed the full-class print flow directly

## Documentation Note

- Treat this file as the authoritative doc for class-print orchestration only.
- Treat `docs/features/UnifiedReportCardPrintSystem.md` as the authoritative doc for shared print rendering behavior.

## Verification

- `convex dev --once --typecheck enable`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`

### 2026-05-04 Batch Print Isolation Pass

- Added `ReportCardBatchPrintStackV2` as a batch-only wrapper around the existing `ReportCardSheet`.
- Admin and teacher `printClass=1` now render through the V2 batch stack.
- Single-student printing was intentionally left on the existing `ReportCardToolbar` + `ReportCardPreview` flow.
- Verification run:
  - `corepack pnpm -C packages/shared exec tsc --noEmit --incremental false --pretty false`
  - `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
  - `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`

### 2026-05-04 Batch Print CSS Ordering Fix

- Corrected `ReportCardBatchPrintStackV2` so its batch-only print CSS is inserted after the shared sheet print CSS.
- This prevents the shared single-print `.rc-print-root { position: fixed; }` rule from overlaying every class report card onto one printed page.
- Batch pages now use isolated `.rc-batch-print-v2-page` rules with one A4 page per report card and sizing aligned with the existing single-print A4 path.
- Single-student printing remains unchanged.

### 2026-05-06 Batch Print Pagination Fix (Flex Ancestor Isolation)

**Problem:** Batch print was rendering a blank page, then a single page with mixed content from two students, despite data loading correctly (7 report cards confirmed via debug badge). Three bugs were stacked:

1. **`body > *:not(.rc-batch-print-v2-root) { display: none }`** hid `#__next` (the Next.js root), which contains the batch root itself → blank page.
2. **Removing the single-print style tag** via `document.getElementById().remove()` was immediately undone because `ReportCardSheet.ensurePrintStyles()` re-injects it during every render (the guard checks `getElementById`, finds nothing, re-creates the tag).
3. **`page-break-after: always` was silently ignored** because every ancestor of the batch root was `display: flex` or had `overflow: hidden` (from `WorkspaceNavbar`'s sidebar layout: `div.flex.h-screen.overflow-hidden > div.flex.flex-col.flex-1 > main.flex-1.overflow-y-auto`). Chrome does not honor CSS page-break rules inside flex/grid containers.

**Solution:** Replaced the CSS-only isolation approach with a JavaScript DOM-walk strategy (same technique as `react-to-print`):

- **`isolateForPrint(element)`** walks from the batch root up to `document.body`:
  - Every **sibling** at each level gets `.rc-batch-print-hide` (hidden via `display: none` in `@media print`).
  - Every **ancestor** gets `.rc-batch-print-ancestor` which forces `display: block !important; overflow: visible !important; position: static !important; height: auto !important` in `@media print`.
- This flattens the entire flex ancestor chain to plain block layout during print, enabling Chrome to correctly paginate `page-break-after: always` on each `.rc-batch-print-v2-page`.
- The batch root stays in **normal document flow** (no `position: absolute/fixed`), so the browser sees N distinct 297mm-tall blocks and creates N print pages.
- On cleanup (unmount), all added classes are removed, restoring the normal flex sidebar layout.

**Key design decisions:**
- Single-print styles are **left untouched** — no removal, no race conditions. The batch print CSS overrides `.rc-print-root` with higher specificity (`.rc-batch-print-v2-page .rc-print-root`) and `!important`.
- The `onReady` callback uses a **double `requestAnimationFrame`** to ensure the browser has fully painted all pages before triggering `window.print()`.
- Single-student printing remains completely unaffected — the DOM-walk classes are only present while the batch component is mounted.

**Files modified:**
- `packages/shared/src/components/ReportCardBatchPrintStackV2.tsx` — complete rewrite with `isolateForPrint()` DOM walk
- `apps/admin/app/assessments/report-cards/page.tsx` — callback-driven print trigger (replaces blind `setTimeout`)
- `apps/teacher/app/assessments/report-cards/page.tsx` — same callback-driven print trigger

**Verification:** All three packages pass `tsc --noEmit`. Tested with 7-student class on teacher portal — print preview shows 7 pages, one per student.

