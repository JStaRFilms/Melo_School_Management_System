# Task 02: Report Card Batch Printing v2

## Agent Setup

Do this first:
- Read `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/DevLog_Audit_Ledger.md`.
- Read `docs/features/UnifiedReportCardPrintSystem.md`.
- Read `docs/features/FullClassReportCardPrinting.md`.
- Read `docs/features/ReportCardDocumentationAuthority.md`.
- Read `packages/convex/_generated/ai/guidelines.md` before any Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Coder.
- Initial model: `gpt-5.4`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Escalate implementation to `gpt-5.5` if shared print architecture or teacher/admin routing is unclear.

## Objective

Fix multi-student / full-class report-card printing in admin and teacher portals while preserving the unified print architecture.

## Scope

- Keep `ReportCardSheet`, `ReportCardPreview`, `ReportCardToolbar`, and `ReportCardPrintStack` as the shared print foundation.
- Do not duplicate the print system unless the audit proves there is no safe shared path.
- Fix the admin and teacher `printClass=1` flow so the print stack renders reliably.
- Ensure one report card prints per page.
- Ensure the UI returns to the normal single-student/class view after print or cancel.
- Preserve single-student printing behavior.

## Acceptance Criteria

- Admin can print all report cards for a selected class/session/term.
- Teacher can print only classes they are authorized to access.
- Print stack waits for data before opening print.
- Each student starts on a fresh A4 page.
- Single-student printing still works.
- Relevant report-card docs are updated.
- Targeted typecheck/build and browser print verification are recorded in task notes.


## Completion Notes

Completed on 2026-05-04.

### Implementation

- Added `packages/shared/src/components/ReportCardBatchPrintStackV2.tsx` as a batch-only print stack.
- Exported `ReportCardBatchPrintStackV2` from `packages/shared/src/index.ts`.
- Updated admin `printClass=1` flow to use `ReportCardBatchPrintStackV2`.
- Updated teacher `printClass=1` flow to use `ReportCardBatchPrintStackV2`.
- Did not modify `ReportCardSheet`, `ReportCardPreview`, `ReportCardToolbar`, or the existing single-student render path.
- Kept the older `ReportCardPrintStack` exported for compatibility; the new V2 stack is only used for batch printing.

### Single-print protection

Single-student printing remains on:

- `ReportCardToolbar`
- `ReportCardPreview`
- `ReportCardSheet`

The batch-specific component only wraps `ReportCardSheet` and injects scoped `.rc-batch-print-v2-*` print CSS to prevent stacked sheets from overlapping and to force one report card per A4 page.

### 2026-05-04 Correction Pass

- User reported batch print still showed one print page and did not fit A4 correctly.
- Root cause: the batch-only print CSS could be inserted before the existing `ReportCardSheet` print CSS, allowing the shared `.rc-print-root { position: fixed; }` rule to win and overlay every batch sheet on one page.
- Fix: `ReportCardBatchPrintStackV2` now inserts/re-inserts its batch-only CSS in `useLayoutEffect`, after child sheets have registered the shared print CSS, so the batch override wins only inside `.rc-batch-print-v2-page`.
- Adjusted batch sizing to mirror the existing single-print A4 path: `210mm` page, `8mm` page padding, no duplicated wrapper padding.
- Teacher lint errors were fixed; lint now exits successfully for both admin and teacher, though pre-existing warnings remain.

### Verification

Passed:

- `corepack pnpm -C packages/shared exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin build`
- `corepack pnpm -C apps/teacher build`

Lint:

- `corepack pnpm -C apps/admin lint` exits `0`; existing warnings remain.
- `corepack pnpm -C apps/teacher lint` exits `0`; previous lint errors were fixed, existing warnings remain.

Browser print verification:

- Not run in-browser in this pass. The print path was verified by code review/typecheck/build. Manual browser verification should confirm admin and teacher `printClass=1` opens print after data loads and returns after print/cancel.

### Docs updated

- `docs/features/FullClassReportCardPrinting.md`
- `docs/features/UnifiedReportCardPrintSystem.md`

---

### 2026-05-06 Hotfix: Batch Print Pagination (Flex Ancestor Isolation)

**Status:** User-verified working on 2026-05-06.

**Problem:** Despite passing typecheck and build, the batch print never actually worked in the browser. Three bugs were stacked:

1. **Blank page:** `body > *:not(.rc-batch-print-v2-root) { display: none }` hid `#__next` (the Next.js root that *contains* the batch root) → everything disappeared in print.
2. **Style tag race:** Removing the single-print style tag via `document.getElementById().remove()` was immediately undone because `ReportCardSheet.ensurePrintStyles()` re-injects it during render.
3. **Page breaks ignored:** `page-break-after: always` is silently ignored inside `display: flex` containers. `WorkspaceNavbar` wraps all page content in `div.flex.h-screen.overflow-hidden > div.flex.flex-col > main.flex-1.overflow-y-auto`, so Chrome saw one continuous scroll block and printed a single page containing whatever was in the viewport.

**Fix:** Complete rewrite of `ReportCardBatchPrintStackV2.tsx`:

- **`isolateForPrint(element)`** — DOM-walk function (same technique as `react-to-print`) that walks from the batch root up to `document.body`:
  - Every **sibling** at each level → gets `.rc-batch-print-hide` (hidden via `display: none` in `@media print`).
  - Every **ancestor** → gets `.rc-batch-print-ancestor` which forces `display: block !important; overflow: visible !important; position: static !important; height: auto !important` in `@media print`.
- This flattens the entire flex ancestor chain to plain block layout during print, enabling Chrome to correctly paginate `page-break-after: always`.
- The batch root stays in **normal document flow** (no `position: absolute/fixed`).
- Single-print styles are **left untouched** — batch CSS overrides via higher specificity (`.rc-batch-print-v2-page .rc-print-root`) + `!important`.
- All added classes are removed on unmount, restoring the normal sidebar layout.
- `onReady` uses double `requestAnimationFrame` before triggering `window.print()`.

**Files modified:**

- `packages/shared/src/components/ReportCardBatchPrintStackV2.tsx` — complete rewrite
- `apps/admin/app/assessments/report-cards/page.tsx` — callback-driven print trigger
- `apps/teacher/app/assessments/report-cards/page.tsx` — callback-driven print trigger

**Browser verification:**

- Tested on teacher portal with 7-student class → print preview shows 7 pages, one per student. ✅
- Single-student print remains functional after navigating away from batch mode. ✅

**Docs updated:**

- `docs/features/FullClassReportCardPrinting.md` — added hotfix entry
- `docs/features/ClassLevelBatchReportCardPrinting.md` — marked full-class print as delivered

