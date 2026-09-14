# B4 selectable billing integration result

## Status

B4 is complete. The focused backend suite, Convex typecheck, full Admin and Portal test suites, both application typechecks and production builds, focused lint, theme audit, and diff checks passed. Convex codegen was attempted without deployment and could not run because this worktree has no `CONVEX_DEPLOYMENT`.

One integration defect was confirmed and fixed. Revisioned Admin payment links could use a stale user-entered amount below the current saved invoice balance. The Admin client now sends the authoritative balance for fee-plan invoices with manageable optional choices. The backend also uses that balance when creating the provider link and rejects attempt persistence if the amount differs from the committed balance for the supplied revision.

No deployment, credential change, staging, or commit occurred.

## Contract review

The final contracts align across Convex, Admin, and Portal:

- Eligible collection reads create no invoice and do not enter persisted totals.
- Parent and Admin collection issuance require selected positive-quantity rows and create positive invoices containing immutable item, unit-price, quantity, and extended-amount snapshots.
- Missing legacy `isSelected` remains included. New `parent_selectable` fee-plan optional rows start with explicit `isSelected: false` while a positive mandatory base remains billed.
- Optional selection updates require the authoritative revision, recalculate subtotal, total, balance, status, and installments, and reject zero-value results.
- Positive `amountPaid` or any payment allocation locks selection updates. Admin and Portal read paths expose authoritative lock fields.
- Parent and Admin payment paths pass the saved selection revision. Revisioned Admin and Portal links use the committed balance, and attempt persistence checks revision, balance, and amount.
- Same-key equivalent creation retries replay prior invoices. Changed fingerprints conflict, and different-key active duplicates cannot create a second invoice.

## Confirmed finding and fix

### High: stale Admin payment-link amount on revisioned invoices

- `apps/admin/app/billing/page.tsx:427` now selects `invoice.balanceDue` for invoices with manageable optional choices rather than submitting a stale draft amount.
- `packages/convex/functions/billing.ts:2382-2395` now rejects persistence when a revisioned link amount differs from the expected committed balance.
- `packages/convex/functions/billing.ts:2986-2997` now sends the authoritative balance to the provider for mixed mandatory/optional fee-plan invoices while preserving existing partial-link behavior for other invoices.
- `packages/convex/functions/billingSelectable.integration.test.ts:476-486` adds the stale-amount regression assertion.

No other confirmed integration defects were found.

## Commands and results

- `git status --short && git diff --stat && git diff --name-only && git diff --cached --name-only`
  - Passed inspection. The index was empty.
- `git diff --no-ext-diff --unified=3` plus untracked-file diffs
  - Reviewed the complete 7,777-line worktree patch before editing.
- `pnpm --filter @school/convex exec vitest run functions/billing.integration.test.ts functions/billingSelectable.integration.test.ts functions/academic/__tests__/tenantPurge.integration.test.ts functions/academic/__tests__/seedCleanup.integration.test.ts functions/academic/__tests__/migrationLifecycle.test.ts`
  - Passed: 5 files, 29 tests. Existing migration lifecycle direct-call warnings and billing timer overflow warnings remain non-failing.
- `pnpm --filter @school/convex typecheck`
  - Passed.
- `pnpm --filter @school/convex convex:codegen`
  - Attempted and blocked before generation: `No CONVEX_DEPLOYMENT set, run npx convex dev to configure a Convex project`.
- `pnpm --filter @school/admin test`
  - Passed before and after the fix: 39 files, 179 tests. Existing `institutional-email.test.tsx` React `act` warnings remain non-failing.
- `pnpm --filter @school/admin typecheck`
  - Passed before and after the fix.
- `set NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud&& pnpm --filter @school/admin build`
  - Failed because that shell form did not export the variable. Next compiled and typechecked, then the existing preview path lacked a Convex provider during prerender.
- `NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud pnpm --filter @school/admin build`
  - Passed before and after the fix: compiled, typechecked, and generated 49 routes.
- `pnpm --filter @school/portal test`
  - Passed: 1 file, 5 tests.
- `pnpm --filter @school/portal typecheck`
  - Passed.
- `pnpm --filter @school/portal build`
  - Passed: compiled, typechecked, and generated 11 routes. Existing workspace-root, Browserslist, and missing public Convex URL warnings remain non-failing.
- `pnpm exec eslint <all changed Admin, Portal, and Convex source/test files>`
  - Passed with no output.
- `node scripts/audit-theme-colors.mjs`
  - Completed. Portal additions use tenant theme tokens for branded controls. Reported amber, emerald, and rose colors are semantic states; slate colors are product neutrals. Existing tracked literals were not globally replaced.
- `pnpm --filter @school/convex exec vitest run functions/billing.integration.test.ts functions/billingSelectable.integration.test.ts && pnpm --filter @school/convex typecheck`
  - Passed after the fix: 2 files, 8 tests, then typecheck.
- `pnpm exec eslint "apps/admin/app/billing/page.tsx" "packages/convex/functions/billing.ts" "packages/convex/functions/billingSelectable.integration.test.ts" && git diff --check && test -z "$(git diff --cached --name-only)"`
  - Passed after the fix. No staged files.
- `git diff --check`
  - Passed.

## Files changed by B4

- `apps/admin/app/billing/page.tsx`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/billingSelectable.integration.test.ts`
- `docs/tasks/orchestrator-sessions/orch-20260914-073210/B4-integration.result.md`

All other worktree changes belong to the selectable-billing feature and this orchestrator session and were preserved.

## Tests added or updated by B4

- Updated `packages/convex/functions/billingSelectable.integration.test.ts` to reject persistence of a revisioned payment attempt whose amount does not match the committed invoice balance.

## Remaining limitations

- Codegen still requires a configured development `CONVEX_DEPLOYMENT`. B4 did not configure or deploy one.
- No live browser-to-Convex-to-Paystack run was possible without project environment configuration. Convex integration tests and both production builds cover the local contract and compilation boundaries.
- The audit reports direct colors already present in touched files and unrelated current-worktree files. No reported feature color violates the tenant-token rule.
- Existing non-failing warnings remain in migration lifecycle tests, billing timers, Admin institutional-email tests, Next workspace-root inference, and Browserslist data.

## Post-R1 continuation verification

B4 resumed after B1, B2, and B3 addressed the five R1 blockers. I inspected each changed implementation and regression test, then reran the affected suites and the complete relevant matrix. All five blockers are closed:

1. **Branch duplication ordering:** `packages/convex/functions/academic/branchSplitV2.ts` now copies `schoolBankAccounts` before `feePlans` and `selectableBillingCollections`. `packages/convex/functions/academic/__tests__/branchSplitBilling.integration.test.ts` executes those table batches and proves both duplicated billing sources reference the duplicated target-school account.
2. **Admin tenant-safe idempotency:** `packages/convex/functions/billing.ts` loads every supplied student and rejects a missing or foreign-school row before building request fingerprints or calling `findCollectionInvoiceRequest`. `packages/convex/functions/billingSelectable.integration.test.ts` proves a colliding request key in another tenant returns `Student not found` rather than exposing an idempotency conflict.
3. **Admin result navigation:** `apps/admin/app/billing/components/forms/SelectableIssuanceForm.tsx` provides invoice actions for created and replayed results, reactively resolves skipped-existing invoices by student, collection, session, and term, and routes all three groups through `apps/admin/app/billing/page.tsx` into the existing invoice finance pack. The Admin focused test exercises all three paths.
4. **Portal student scoping:** `apps/portal/app/(portal)/components/portal-workspace/PortalBillingView.tsx` filters locally returned invoices by `workspace.selectedStudentId` and clears the prior announcement when student or period changes. Its regression test proves the prior student's invoice and Pay action disappear after switching students.
5. **Portal request-key invalidation:** decrement, direct quantity input, and increment use `updateItemQuantity`, which clears an earlier request key before changing the payload. Parameterized tests prove all three controls produce a new key while an unchanged uncertain retry keeps its original key.

No post-R1 integration regression was found, so this continuation changed no source or test files.

### Post-R1 commands and results

- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/branchSplitBilling.integration.test.ts functions/billingSelectable.integration.test.ts`
  - Passed: 2 files, 6 tests.
- `pnpm --filter @school/admin exec vitest run __tests__/billing-selectable-items.test.tsx`
  - Passed: 1 file, 5 tests.
- `pnpm --filter @school/portal exec vitest run __tests__/parent-selectable-billing.test.tsx`
  - Passed: 1 file, 9 tests.
- `pnpm --filter @school/convex exec vitest run functions/billing.integration.test.ts functions/billingSelectable.integration.test.ts functions/academic/__tests__/branchSplitBilling.integration.test.ts functions/academic/__tests__/tenantPurge.integration.test.ts functions/academic/__tests__/seedCleanup.integration.test.ts functions/academic/__tests__/migrationLifecycle.test.ts`
  - Passed: 6 files, 31 tests. Existing migration lifecycle direct-call warnings and billing timer overflow warnings remain non-failing.
- `pnpm --filter @school/convex typecheck`
  - Passed with no TypeScript errors.
- `pnpm --filter @school/admin test`
  - Passed: 39 files, 180 tests. Existing `institutional-email.test.tsx` React `act` warnings remain non-failing.
- `pnpm --filter @school/admin typecheck`
  - Passed with no TypeScript errors.
- `NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud pnpm --filter @school/admin build`
  - Passed: compiled, typechecked, and generated 49 routes.
- `pnpm --filter @school/portal test`
  - Passed: 1 file, 9 tests.
- `pnpm --filter @school/portal typecheck`
  - Passed with no TypeScript errors.
- `pnpm --filter @school/portal build`
  - Passed: compiled, typechecked, and generated 11 routes. Existing missing public Convex URL, workspace-root, and Browserslist warnings remain non-failing.
- `pnpm exec eslint "packages/convex/functions/academic/branchSplitV2.ts" "packages/convex/functions/academic/__tests__/branchSplitBilling.integration.test.ts" "packages/convex/functions/billing.ts" "packages/convex/functions/billingSelectable.integration.test.ts" "apps/admin/app/billing/page.tsx" "apps/admin/app/billing/components/BillingSidebar.tsx" "apps/admin/app/billing/components/forms/SelectableIssuanceForm.tsx" "apps/admin/__tests__/billing-selectable-items.test.tsx" "apps/portal/app/(portal)/components/portal-workspace/PortalBillingView.tsx" "apps/portal/__tests__/parent-selectable-billing.test.tsx"`
  - Passed with no output.
- `node scripts/audit-theme-colors.mjs`
  - Completed. The R1 fixes add no tenant-brand color violation. Reported feature colors remain tenant tokens, semantic statuses, or product neutrals.
- `git diff --check && test -z "$(git diff --cached --name-only)"`
  - Passed. No whitespace errors and no staged files.

### Post-R1 residual limitations

- Convex codegen remains unavailable without a configured development `CONVEX_DEPLOYMENT`; the earlier B4 attempt and exact CLI error are recorded above.
- No deployment or live provider call was performed.
- Existing non-failing warnings listed above are unchanged and outside the selectable-billing fixes.

## Final worktree scope

The worktree contains the selectable billing backend, lifecycle registration, Admin UI, Parent Portal UI, focused tests, feature documentation, and session task/result artifacts. This B4 continuation modified only `docs/tasks/orchestrator-sessions/orch-20260914-073210/B4-integration.result.md`. `git diff --cached --name-only` is empty.
