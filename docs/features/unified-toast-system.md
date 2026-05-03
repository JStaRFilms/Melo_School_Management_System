# Unified Toast Notification System

## Status

Design blueprint for implementation. No code has been implemented as part of this task.

## Goal

Create one consistent transient notification system for the `admin`, `teacher`, `platform`, and `portal` apps. Global action feedback should be visible regardless of scroll position, while detailed inline validation and the persistent product notification center remain separate concepts.

## Audit Summary

### Shared package structure

- Shared package: `packages/shared`
- Public barrel: `packages/shared/src/index.ts`
- Current exports include domain helpers and shared React components.
- Existing package export map exposes `.` plus selected subpaths.
- Proposed toast files should live under `packages/shared/src/toast/` and export through both:
  - `@school/shared` via `packages/shared/src/index.ts`
  - `@school/shared/toast` via `packages/shared/package.json` export map

### Root layout targets

Mount one toaster in each root layout:

- `apps/admin/app/layout.tsx`
- `apps/teacher/app/layout.tsx`
- `apps/platform/app/layout.tsx`
- `apps/portal/app/layout.tsx`

All four layouts are server components wrapping `ConvexClientProvider` and `AuthProvider`. `AppToaster` must be a client component exported from `@school/shared/toast` and can be rendered from these server layouts.

### Dependency state

- `sonner` is not currently installed.
- Add `sonner` to `packages/shared/package.json` dependencies because the wrapper and UI component live in the shared package.
- `apps/platform/package.json` currently does not depend on `@school/shared`; add `"@school/shared": "workspace:*"` before importing the toaster there.

## Architecture Decision

Use a two-layer architecture around Sonner.

### 1. System layer

Owns the stable app-facing API. App code imports this layer and must not import `sonner` directly.

Target files:

- `packages/shared/src/toast/types.ts`
- `packages/shared/src/toast/defaults.ts`
- `packages/shared/src/toast/error-message.ts`
- `packages/shared/src/toast/app-toast.ts`
- `packages/shared/src/toast/index.ts`

Responsibilities:

- Provide `appToast` methods for `success`, `error`, `warning`, `info`, and optional `loading`/`dismiss` if needed.
- Normalize unknown caught errors with a privacy-safe `getErrorMessage` helper.
- Centralize default durations and option types.
- Keep call sites style-free.

Proposed API shape:

```ts
import { appToast, getErrorMessage } from "@school/shared/toast";

appToast.success("Saved changes");
appToast.info("Sync started", { description: "This may take a moment." });
appToast.warning("Review required", { description: "Some rows need attention." });
appToast.error("Unable to save", { description: getErrorMessage(error) });
```

Suggested types:

```ts
type AppToastVariant = "success" | "error" | "warning" | "info";

type AppToastOptions = {
  description?: string;
  duration?: number;
  id?: string | number;
  action?: {
    label: string;
    onClick: () => void;
  };
};
```

### 2. UI layer

Owns visual presentation and Sonner `Toaster` configuration.

Target files:

- `packages/shared/src/toast/AppToaster.tsx`
- Optional future file: `packages/shared/src/toast/toast-theme.ts`

Responsibilities:

- Render the Sonner `Toaster`.
- Centralize placement, rich colors, close button, class names, z-index, and dark/light theme mapping.
- Make future visual redesign possible by editing `AppToaster` and theme tokens only.
- Avoid leaking style options to app call sites.

## UX Defaults

- Position: `top-center` for cross-app visibility.
- Close button: enabled.
- Rich colors: enabled unless custom styling supersedes it.
- Duration defaults:
  - Success: 5 seconds
  - Info: 5 seconds
  - Warning: 8 seconds
  - Error: 10 seconds
- Destructive or unrecoverable errors may be made persistent case-by-case by passing `duration: Infinity` only where justified.
- Hover/focus behavior: rely on Sonner default pause-on-hover behavior; do not dismiss immediately while users are interacting.
- Z-index: toaster should sit above dialogs/menus. Configure a high z-index in `AppToaster` classes if needed.
- Accessibility: use concise titles, helpful descriptions, and avoid relying on color alone. Toasts should complement, not replace, visible inline correction guidance.

## Error Message and Privacy Policy

Use `getErrorMessage(error, fallback?)` for unknown caught values.

Rules:

- Show useful user-facing messages when errors are known and safe.
- Never expose stack traces, raw serialized objects, tokens, secret values, SQL/Convex internals, or provider credentials.
- Prefer a generic fallback like `Something went wrong. Please try again.` when message safety is unclear.
- Keep title short (`Unable to save`) and details in `description`.
- Avoid duplicating large validation lists inside a toast.

## Migration Rules

### Use toast for

- Sign-in failures and auth operation failures.
- Create/update/delete operation failures.
- Successful saves or completion feedback where current UI has no durable confirmation.
- Global workspace loading/action failures that may occur off-screen.
- Submit/save blocked alerts when the detailed validation guidance remains inline.

### Keep inline for

- Field-level validation.
- Row/table validation details.
- Form correction guidance.
- Empty states and page-level blocking states.
- Anything the user must keep referencing while fixing data.

### Keep product notification center separate

Do not replace persistent domain notifications, inbox-style alerts, approval queues, or history/audit events with toast messages. Toasts are ephemeral action feedback only.

## Known Migration Targets

High-impact global error targets:

- `apps/admin/app/sign-in/page.tsx`
- `apps/teacher/app/sign-in/page.tsx`
- `apps/platform/app/sign-in/page.tsx`
- `apps/platform/app/schools/create/page.tsx`
- `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx`
- `apps/teacher/app/planning/lesson-plans/page.tsx`
- `apps/teacher/app/planning/question-bank/page.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx`

Validation-heavy targets requiring inline guidance preservation:

- `apps/admin/app/assessments/results/entry/page.tsx`
- `apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx`
- `apps/admin/app/assessments/setup/grading-bands/components/BandValidationBanner.tsx`

One-off toast-like cleanup target:

- `apps/teacher/app/enrollment/subjects/components/FloatingNotice.tsx`

## Implementation Order

1. Add `sonner` dependency to `packages/shared` and add `@school/shared` to `apps/platform`.
2. Create shared toast system files and exports.
3. Mount one `AppToaster` in each target app root layout.
4. Replace high-impact global error surfaces with `appToast`.
5. Apply validation policy to validation-heavy flows.
6. Clean up one-off toast-like components.
7. Run final review for direct Sonner imports, duplicate toasters, validation regressions, and type/lint/build status.

## Ownership Guidance

If multiple agents are used:

- System-layer agent owns `types`, `defaults`, `error-message`, `app-toast`, and exports.
- UI-layer agent owns `AppToaster` and visual/theming configuration.

If one agent implements both, they must self-check that the toast appearance can be redesigned by editing `AppToaster` only, with no changes to migrated app call sites.

## Non-goals

- Do not build a persistent notification center.
- Do not convert every validation detail into a toast.
- Do not add direct Sonner imports to application pages/components.
- Do not change unrelated app layout/provider structure.
- Do not redesign page-level UI as part of this feature.

## Acceptance Criteria

- `@school/shared/toast` exports `AppToaster`, `appToast`, `getErrorMessage`, and relevant types.
- Sonner is directly imported only inside the shared toast module.
- Each of `admin`, `teacher`, `platform`, and `portal` mounts exactly one `AppToaster` in its root layout.
- App call sites use `appToast` and do not own toast styling.
- UI styling can be revised by editing `AppToaster` without changing the system API or app call sites.
- Inline validation remains available where it provides actionable correction guidance.
- Product/domain notification center behavior is not replaced or removed.
- Verification results are documented for typecheck, lint, and build or scoped equivalents.
