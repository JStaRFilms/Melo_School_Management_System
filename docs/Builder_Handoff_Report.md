# Builder Handoff Report: Unified Toast Notification System

## Built Features

- Added a shared Sonner-backed toast foundation in `@school/shared/toast`.
- Mounted one shared `AppToaster` in each target app root layout: admin, teacher, platform, and portal.
- Replaced high-impact global operation errors with `appToast`.
- Added validation-blocked save warning toasts while preserving useful inline row/table/field guidance.
- Removed the teacher enrollment `FloatingNotice` one-off component and migrated its behavior to `appToast`.
- Kept persistent domain notification center behavior separate from transient toast feedback.

## Key Files Created

- `packages/shared/src/toast/AppToaster.tsx`
- `packages/shared/src/toast/app-toast.ts`
- `packages/shared/src/toast/defaults.ts`
- `packages/shared/src/toast/error-message.ts`
- `packages/shared/src/toast/index.ts`
- `packages/shared/src/toast/types.ts`
- `docs/features/unified-toast-system.md`

## Key Files Updated

- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `apps/admin/app/layout.tsx`
- `apps/teacher/app/layout.tsx`
- `apps/platform/app/layout.tsx`
- `apps/portal/app/layout.tsx`
- `apps/admin/app/sign-in/page.tsx`
- `apps/teacher/app/sign-in/page.tsx`
- `apps/platform/app/sign-in/page.tsx`
- `apps/platform/app/schools/create/page.tsx`
- `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx`
- `apps/teacher/app/planning/lesson-plans/page.tsx`
- `apps/teacher/app/planning/question-bank/page.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx`
- `apps/admin/app/assessments/results/entry/page.tsx`
- `apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx`
- `apps/admin/app/assessments/results/entry/components/AdminSaveActionBar.tsx`
- `apps/teacher/app/assessments/exams/entry/components/SaveActionBar.tsx`
- `apps/teacher/app/enrollment/subjects/page.tsx`
- `apps/teacher/app/enrollment/subjects/components/types.ts`

## Files Deleted

- `apps/teacher/app/enrollment/subjects/components/FloatingNotice.tsx`

## Verification Status

### Typecheck

Passed for affected packages:

- `pnpm --filter @school/shared typecheck`
- `pnpm --filter @school/admin typecheck`
- `pnpm --filter @school/teacher typecheck`
- `pnpm --filter @school/platform typecheck`
- `pnpm --filter @school/portal typecheck`

Full `pnpm typecheck` was attempted but timed out after 300 seconds after completing multiple package builds/typechecks. Scoped affected package typechecks passed.

### Build

Passed for affected apps:

- `pnpm --filter @school/admin build`
- `pnpm --filter @school/teacher build`
- `pnpm --filter @school/platform build`
- `pnpm --filter @school/portal build`

### Lint

- `pnpm --filter @school/admin lint` completed with existing warnings only.
- `pnpm --filter @school/teacher lint` failed due to pre-existing unrelated issues in planning library/question-bank files, not from the toast migration.

### Architecture/Regression Review

- Deep review subagent used `oauth-router/gpt-5.5`.
- No P0/P1 findings.
- Direct Sonner imports are limited to:
  - `packages/shared/src/toast/AppToaster.tsx`
  - `packages/shared/src/toast/app-toast.ts`
- Each target app mounts exactly one `AppToaster`.
- Validation inline guidance was preserved where it remains actionable.

## How to Run

```bash
pnpm install
pnpm --filter @school/shared typecheck
pnpm --filter @school/admin typecheck
pnpm --filter @school/teacher typecheck
pnpm --filter @school/platform typecheck
pnpm --filter @school/portal typecheck
```

To run target apps:

```bash
pnpm --filter @school/admin dev
pnpm --filter @school/teacher dev
pnpm --filter @school/platform dev
pnpm --filter @school/portal dev
```

## Future Follow-up

- Consider cleaning remaining legacy inline/floating notices outside this feature scope.
- Address existing lint baseline issues in teacher planning-library/question-bank files.
- If desired, refine `AppToaster` visual styling centrally without changing app call sites.
