# Report Card Bundle Setup Performance

## Goal
Reduce interaction latency and browser instability on the admin report-card bundle setup page, especially when editing bundle fields, switching field types, selecting reusable scales, and managing class assignments.

The target outcome is that bundle-editor interactions feel immediate even when a school has many classes and several saved bundles.

## Components: Client vs Server

### Client

- `apps/admin/app/assessments/setup/report-card-bundles/page.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/components/ReportCardBundlesScreen.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/components/BundleEditor.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/components/BundlePreview.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/components/ClassAssignmentPanel.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/utils.ts`

### Server

- `packages/convex/functions/academic/reportCardExtras.ts`
- `packages/convex/functions/academic/adminSelectors.ts`

## Current Root-Cause Findings

### 1. Per-class live subscription fan-out

The class assignment panel mounts one live Convex query per class via `LiveAssignmentObserver`.

- `getAllClasses` returns the full class list.
- The page then renders one `useQuery("...getClassReportCardExtraBundles", { classId })` for every class.
- On a school with many classes, the route creates many simultaneous live subscriptions and many assignment state updates.

This is the biggest data-loading concern on the page.

### 2. Full-page rerender on every editor change

`ReportCardBundlesScreen` stores the full bundle draft in page-level state and passes it into:

- `BundleEditor`
- `BundlePreview`
- `renderAssignmentPanel(bundleDraft.bundleId)`

Every field edit, type switch, reorder click, or scale selection rerenders the entire screen, including the heavy class-assignment panel.

### 3. Heavy assignment panel render cost

The assignment panel renders:

- every visible class row
- selection controls per class
- one bundle chip checkbox per bundle inside every class row

That creates a large DOM tree. When combined with page-wide rerenders, even a simple select change can become noticeably slow.

### 4. Draft dirty-state recalculation on each render

`ReportCardBundlesScreen` recomputes `scaleDirty` and `bundleDirty` by serializing entire draft structures every render. This is not likely the primary cause of the browser crashes, but it adds avoidable work on top of the larger rerender problem.

## Components To Change

### Client changes

1. Replace per-class assignment observers with one batched assignments query for all classes.
2. Isolate class-assignment UI from bundle-editor state so typing in the editor does not rerender the full assignment panel.
3. Memoize or split expensive sections so editor changes rerender only the editor and preview.
4. Reduce repeated lookup work inside assignment rendering.
5. Keep the current UX and saved data shape unchanged.

### Server changes

1. Add a batched query that returns report-card bundle assignments for all classes in the current school.
2. Keep existing per-class mutation behavior unless a batching change is clearly needed.

## Data Flow

### Current flow

1. Page loads all classes.
2. Class assignment panel mounts one live query per class.
3. Each query updates local assignment state independently.
4. Editing a bundle field rerenders the entire screen, including the full assignment panel.

### Target flow

1. Page loads classes, bundles, scales, and all class assignments with a small fixed number of queries.
2. Assignment state is derived from one batched result instead of one observer per class.
3. Editing a bundle field rerenders only bundle-related components.
4. Class assignment UI updates only when assignment inputs actually change.

## Database Schema

No schema change is required.

The work should continue using:

- `reportCardExtraBundles`
- `reportCardExtraScaleTemplates`
- `reportCardExtraClassAssignments`
- `classes`

Only the query shape changes: from per-class reads to a school-scoped batched read.

## Regression Checks

- Bundle creation and editing still work for existing saved bundles.
- Reusable scale selection still updates correctly for scale-type fields.
- Class assignment add/remove actions still persist correctly.
- Schools with no bundles or no class assignments still render cleanly.
- The page continues to work in both live Convex mode and mock mode.
- No behavior regressions are introduced in report-card extras entry or report-card printing.

## Approval Gate

This document is the blueprint for the performance fix.

Implementation should:

1. batch class assignments on the server,
2. decouple the assignment panel from editor keystroke rerenders,
3. keep current UX and data behavior stable,
4. update this document after the fix is complete.

## Implementation Notes

Completed on March 29, 2026.

- Added `listSchoolReportCardExtraBundleAssignments` in `packages/convex/functions/academic/reportCardExtras.ts` so the page can subscribe to all class assignments with one school-scoped live query instead of one query per class.
- Updated `apps/admin/app/assessments/setup/report-card-bundles/page.tsx` to use the batched assignments query and pass a stable assignment map into the assignment panel.
- Removed the per-class `LiveAssignmentObserver` subscription pattern from `apps/admin/app/assessments/setup/report-card-bundles/components/ClassAssignmentPanel.tsx`.
- Memoized the class assignment panel content so it can stay mounted without rerendering on every bundle field edit.
- Memoized the rendered assignment panel element in `apps/admin/app/assessments/setup/report-card-bundles/components/ReportCardBundlesScreen.tsx` so editor changes do not force reconciliation of the class-assignment subtree when the selected bundle identity has not changed.
- Wrapped fallback query arrays in memoized values in `page.tsx` so lint does not flag unstable dependency identities in the new data path.
- Also fixed the pre-existing hook dependency warning in `apps/admin/app/assessments/report-card-extras/components/ExtrasWorkspace.tsx` by stabilizing the derived `bundles` reference.

## Verification

- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/convex typecheck`
- `pnpm --filter @school/admin lint`
- `pnpm --filter @school/convex lint`
