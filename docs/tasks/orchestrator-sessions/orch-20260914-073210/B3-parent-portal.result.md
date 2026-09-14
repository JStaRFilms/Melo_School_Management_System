# B3 Parent Portal result

## Status

Completed. The Parent Portal now reads eligible selectable collections separately from invoices, creates a positive invoice only after review of a valid non-empty selection, supports revisioned class-default optional choices, and passes the saved selection revision into payment initialization.

The two confirmed R1 blockers were fixed. Locally returned invoices are scoped to the selected student, and every quantity control clears an earlier submission key before a changed payload can be submitted.

No backend behavior changed in B3. No files were staged or committed.

## Implementation

- Added a Parent-only "Available to buy" section for active linked students. Student viewers and historical enrollments remain read-only.
- Added an inline item chooser with quantities from 1 to 9999, estimated review totals, explicit invoice-creation confirmation, and a stable request key for uncertain retries.
- Handles `DUPLICATE_INVOICE`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_FAILED`, `NOT_FOUND`, `FORBIDDEN`, and `ZERO_VALUE_INVOICE` without creating client-side authorization or amount fallbacks.
- Renders returned collection invoice snapshots with quantity, unit price, and extended line total. Payment appears only after the authoritative positive invoice exists.
- Added optional-row editing for projected editable class-default invoices. Saves include `expectedSelectionRevision`, mutation responses replace local invoice values, and payment stays disabled while choices are dirty or saving.
- Handles stale revisions, permission loss, zero-value rejection, and payment locks. Locked choices switch to read-only.
- Payment initialization includes `expectedSelectionRevision` when the invoice projection has one. Checkout conflicts prompt review of the latest invoice.
- Added a stacked mobile payment-history layout and tenant-token primary actions.
- Scoped locally returned invoices and creation announcements to the selected student so switching students cannot expose another child's invoice or Pay action.
- Routed decrement, direct quantity input, and increment through one quantity update path that clears an existing request key. An unchanged retry still retains its original key.

## R1 blocker fixes

- **High, fixed:** `apps/portal/app/(portal)/components/portal-workspace/PortalBillingView.tsx` previously merged every locally created invoice into the current invoice list. It now filters local invoices by `workspace.selectedStudentId` and clears the prior creation announcement on a student or period change.
- **High, fixed:** `apps/portal/app/(portal)/components/portal-workspace/PortalBillingView.tsx` previously retained `requestKey` when quantity changed through decrement, direct input, or increment. All three controls now call `updateItemQuantity`, which clears the key before updating quantity.

## Files changed

- `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`
- `apps/portal/app/(portal)/components/portal-workspace/PortalBillingView.tsx`
- `apps/portal/lib/portal-types.ts`
- `apps/portal/lib/portal-billing.ts`
- `apps/portal/__tests__/parent-selectable-billing.test.tsx`
- `apps/portal/__tests__/setup.ts`
- `apps/portal/vitest.config.mts`
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B3-parent-portal.result.md`

## Tests added

`apps/portal/__tests__/parent-selectable-billing.test.tsx` has nine focused component/unit tests covering:

- separation of available collections from invoices and the zero-selection gate
- authoritative invoice snapshot rendering and payment availability after creation
- same-key retry after an uncertain result
- current-revision optional updates, dirty-payment blocking, and stale conflict handling
- payment request revision forwarding
- student read-only and payment-allocation lock projections
- rerendering from child A to child B removes child A's locally created invoice, announcement, and Pay action
- timeout, Back, and changed quantity resubmission generates a new key for decrement, direct input, and increment

## Verification

- `pnpm --filter @school/portal exec vitest run __tests__/parent-selectable-billing.test.tsx`
  - Passed after the R1 fixes: 1 file, 9 tests.
- `pnpm --filter @school/portal test`
  - Passed during the initial B3 implementation: 1 file, 5 tests. The later focused R1 run supersedes this count with 9 passing tests.
- `pnpm --filter @school/portal typecheck`
  - Passed with no TypeScript errors.
- `pnpm --filter @school/portal exec eslint "app/(portal)/components/portal-workspace/PortalBillingView.tsx" "app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx" "lib/portal-types.ts" "lib/portal-billing.ts" "__tests__/parent-selectable-billing.test.tsx" "vitest.config.mts"`
  - Passed with no output during initial B3 verification.
- `pnpm --filter @school/portal exec eslint "app/(portal)/components/portal-workspace/PortalBillingView.tsx" "__tests__/parent-selectable-billing.test.tsx"`
  - Passed after the R1 fixes with no errors or warnings.
- `pnpm --filter @school/portal build`
  - Passed. Next.js compiled, typechecked, and generated all Portal routes. It printed existing environment warnings for the inferred workspace root, stale Browserslist data, and missing `NEXT_PUBLIC_CONVEX_URL` during static generation.
- `node scripts/audit-theme-colors.mjs`
  - Passed as an informational audit. Reported tracked Portal workspace amber and emerald colors are semantic warning/status colors. New purchase actions use `bg-brand-primary` and `text-brand-primary-contrast`; new surfaces use tenant-derived tokens or product-neutral slate.
- `git diff --check`
  - Passed.
- `git diff --cached --name-only`
  - No output. No staged files.

## Acceptance notes

- Eligible collection reads do not enter billing totals and invoke no mutation.
- Empty or invalid selections cannot reach invoice creation.
- Parent mutation calls contain student, period, collection, request key, and item selections only. They do not send school or amount authorization fields.
- Student-role and unrelated-user mutation restrictions remain backed by the B1 projections and server contracts.
- Inventory and fulfilment remain out of scope.

## Residual risks

- Verification used focused component tests with mocked B1 calls. This worktree has no configured Portal Convex environment, so no browser-level live-backend checkout was run.
- The Next.js build warns that `NEXT_PUBLIC_CONVEX_URL` is absent. The build succeeds and renders the existing non-Convex preview path.
