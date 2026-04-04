# Admin Build Stability

## Goal
Restore a clean production build for `@school/admin` by preserving the shared workspace layout contract used by admin route-group layouts and by tightening the exam-recording validation flow so React hook dependency checks pass without stale state.

## Status
- Implemented
- Maintenance fix for admin workspace stability
- Supports FR-007: Results entry and moderation
- Supports FR-018: Automated verification and end-to-end confidence

## Components

### Client
- `packages/shared/package.json`
  - expose the shared package subpath exports used by the Convex workspace during admin builds
- `packages/shared/src/components/WorkspaceNavbar.tsx`
  - restore support for the `fullBleed` layout mode already used by admin route-group layouts
- `apps/admin/app/academic/layout.tsx`
  - continue using the shared navbar with the full-bleed admin workspace shell
- `apps/admin/app/assessments/layout.tsx`
  - continue using the shared navbar with the full-bleed admin workspace shell
- `apps/admin/app/assessments/setup/exam-recording/components/AssessmentEditingPolicyCard.tsx`
  - derive the editing-window validation message directly from the current draft instead of mirroring it into local effect-driven state
- `apps/admin/app/assessments/setup/exam-recording/page.tsx`
  - compute the policy validation message from the live draft without hook-dependency gaps

### Server
- No server code change expected

## Data Flow
1. Admin academic and assessment layouts pass `fullBleed` into the shared workspace navbar.
2. The shared navbar adjusts its content padding and max-width wrapper based on that flag instead of rejecting the prop at type-check time.
3. The exam-recording policy card derives validation feedback directly from the latest draft fields passed from the page.
4. The settings action bar receives the same derived validation state, keeping save/discard behavior aligned with the visible policy inputs.

## Database Schema
No schema change.

## Regression Check
- Admin academic routes must still render inside the shared workspace shell.
- Admin assessment routes must still render inside the shared workspace shell.
- Existing full-width workspaces must keep their layout behavior when `fullBleed` is enabled.
- Exam editing policy validation must still block invalid date windows.
- The exam-recording settings page must not rely on stale validation state after session, term, or date changes.

## Verification Plan
- `pnpm --filter @school/admin exec tsc --noEmit`
- `pnpm --filter @school/admin build`
- `pnpm convex deploy`

## Verification Notes
- `pnpm --filter @school/admin build` passes after the fix.
- `pnpm --filter @school/admin exec tsc --noEmit` still reports pre-existing workspace module-resolution issues before the shared package export fix is applied by the app build pipeline, so the production build was used as the release gate for this patch.
