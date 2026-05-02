# Unified Toast Notification System — Genesis Plan

## Current Takomi Stage

Genesis / discovery + planning.

## Session

- Session ID: `orch-20260428-204715`
- Goal: Plan a unified app-wide toast notification system before implementation.

## Problem

Notification and error UI is currently scattered across the codebase. Many errors render inline near the top of a page, so users who are scrolled down may not see the message and only know that something failed.

## Mission

Create a consistent app-wide toast notification system that displays global success, error, warning, and info feedback above the current page content without requiring the user to scroll.

## Target Apps

- `apps/admin`
- `apps/teacher`
- `apps/platform`
- `apps/portal`

## Recommended Direction

Use a shared Sonner-based toast abstraction rather than direct Sonner usage throughout the app.

The implementation must be modular in two layers:

1. System layer: the stable notification API and behavior policy.
2. UI layer: the tweakable toast renderer/component.

The system layer should be safe to call from app UI code without exposing Sonner directly. The UI layer should be isolated so the visual design can be revised later by editing `AppToaster` and its styling without touching every page that calls `appToast`.

Proposed shared API:

```ts
import { appToast } from "@school/shared/toast";

appToast.success("Saved successfully.");
appToast.error("Unable to save changes.", {
  description: "Your changes were not saved. Please try again.",
});
appToast.warning("Please fix validation errors.");
appToast.info("Draft restored.");
```

Proposed shared files:

```txt
packages/shared/src/toast/
  index.ts
  app-toast.ts
  error-message.ts
  toast-types.ts
  toast-defaults.ts
  AppToaster.tsx
```

Layer ownership:

```txt
System layer
  app-toast.ts
  error-message.ts
  toast-types.ts
  toast-defaults.ts
  index.ts

UI layer
  AppToaster.tsx
  any toast-specific CSS/classes/theme mapping
```

Root layouts should mount one shared toaster:

```txt
apps/admin/app/layout.tsx
apps/teacher/app/layout.tsx
apps/platform/app/layout.tsx
apps/portal/app/layout.tsx
```

## UX Rules

- Default position: `top-center` for maximum visibility.
- Toasts must appear above all app content.
- Toasts must not require scrolling to see.
- Toasts should include a close button.
- Toasts should support title + detailed description.
- Toast call sites should not contain visual styling decisions.
- Visual appearance should be centralized in `AppToaster` or toast-specific shared UI helpers.
- Success/info: about 5 seconds.
- Warning: about 8 seconds.
- Error: long-lived or persistent depending on severity.
- Hovering should prevent immediate dismissal where supported.
- Use consistent visual states for success, error, warning, and info.

## Important Distinction

Do not confuse transient toast notifications with persistent product/domain notifications.

- Toast: temporary UI feedback for actions/errors.
- Notification center: persistent in-app/domain notifications such as billing or school updates.
- Inline validation: field/table-specific correction guidance.

## Non-Goals

- Do not replace every validation banner blindly.
- Do not remove useful inline validation context.
- Do not merge toast UI with the existing notification center.
- Do not expose sensitive backend/internal error details to users.

## Replacement Strategy

### Phase 1 — Foundation

- Install/add Sonner if not already present.
- Create shared `AppToaster`.
- Create shared `appToast` wrapper.
- Create `getErrorMessage(error: unknown)` helper.
- Export from shared package.
- Add `<AppToaster />` to all root layouts.

### Phase 2 — High-Impact Replacements

Prioritize obvious global operation errors:

```txt
apps/admin/app/sign-in/page.tsx
apps/teacher/app/sign-in/page.tsx
apps/platform/app/sign-in/page.tsx
apps/platform/app/schools/create/page.tsx
apps/platform/app/schools/[schoolId]/assign-admin/page.tsx
apps/teacher/app/planning/lesson-plans/page.tsx
apps/teacher/app/planning/question-bank/page.tsx
apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx
```

Especially replace the manually coded fixed popup in:

```txt
apps/admin/app/assessments/setup/grading-bands/components/BandsActionBar.tsx
```

### Phase 3 — Validation UX Review

Review rather than blindly replace:

```txt
apps/admin/app/assessments/results/entry/page.tsx
apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx
apps/admin/app/assessments/setup/grading-bands/components/BandValidationBanner.tsx
```

Likely rule:

- Keep inline validation where it helps users correct specific rows/fields.
- Add a toast on submit/save when validation blocks the action.

### Phase 4 — Remove One-Off Toast-Like Components

Review:

```txt
apps/teacher/app/enrollment/subjects/components/FloatingNotice.tsx
```

Possible outcomes:

- Replace with `appToast`.
- Delete if no longer used.
- Keep only if it serves a specialized local UX not covered by global toasts.

## Acceptance Criteria

- [ ] Shared toast API exists in `packages/shared`.
- [ ] Toast system logic and toast UI component are separated cleanly.
- [ ] App pages import the shared API, not Sonner directly.
- [ ] Visual styling can be adjusted in `AppToaster` without changing app call sites.
- [ ] Each root app layout renders one global toaster.
- [ ] Toasts are visible regardless of page scroll.
- [ ] Toasts appear above app content.
- [ ] Toasts support success, error, warning, and info states.
- [ ] Toasts support detailed descriptions.
- [ ] Toasts have close behavior.
- [ ] Error messages use a shared helper for unknown errors.
- [ ] Sign-in errors show as toasts.
- [ ] Platform school creation errors show as toasts.
- [ ] Platform admin assignment errors show as toasts.
- [ ] Teacher planning workspace errors show as toasts.
- [ ] Manual fixed popup in `BandsActionBar.tsx` is replaced.
- [ ] Validation-heavy pages preserve useful inline context.
- [ ] Existing notification-center/domain notification code is not conflated with toast UI.
- [ ] Typecheck/lint/build pass.

## Proposed Task Breakdown

### Task 1 — Discovery Audit and Toast Decision Record

- Role: Architect
- Model: GPT-5.5
- Purpose: Confirm notification patterns, package structure, import aliases, and Sonner fit.
- Output: `docs/features/unified-toast-system.md`

### Task 2 — Shared Toast Foundation

- Role: Coder
- Model: GPT-5.4
- Purpose: Add shared toast system files and isolated UI component.
- Ownership split: one agent may own the system layer and another may own the UI layer, or one agent may implement both while preserving the layer boundary.

### Task 3 — High-Impact Error UI Replacement

- Role: Coder
- Model: GPT-5.4
- Purpose: Replace obvious scattered global error UI with `appToast`.

### Task 4 — Validation UX Review

- Role: Architect/Designer
- Model: GPT-5.5 or GPT-5.4 depending on complexity
- Purpose: Decide which validation banners remain inline and where toast alerts should be added.

### Task 5 — Deep Review and Regression Pass

- Role: Reviewer
- Model: GPT-5.5
- Purpose: Check imports, server/client boundaries, direct Sonner usage, accessibility, layout duplication, and regressions.

## Model Routing Rule

Use the user-provided routing strategy:

- GPT-5.5 for judgment-heavy, architecture, regression, validation UX, and final review.
- GPT-5.4 for default implementation.
- GPT-5.4 Mini only for small, explicit, isolated edits.

Before any subagent dispatch or model override, run and surface:

```bash
pi --list-models
```

## Recommended Next Stage

Move to Design and create:

```txt
docs/features/unified-toast-system.md
```

That document should become the formal blueprint before implementation begins.
