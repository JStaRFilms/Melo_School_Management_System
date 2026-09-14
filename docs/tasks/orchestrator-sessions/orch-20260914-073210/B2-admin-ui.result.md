# B2 Admin UI result

## Status

B2 is complete. The corrected B1 Admin projection is consumed without client-side lock inference. No backend behavior was changed and no files were staged or committed.

## Delivered

- Added a separate `Selectable items` tab under Admin `/billing` without changing Plans or Bulk Invoicing.
- Added active and inactive collection listing, permission-aware actions, class eligibility summaries, and loading and empty states.
- Added collection creation for name, description, eligible classes, currency, settlement account, item descriptions, categories, and positive unit prices.
- Added a three-step issuance flow for collection, period, eligible class, one or several students, selected items, quantities, due date, settlement account, notes, and review.
- Kept the generated request key for an unchanged retry. Issuance results separate Created, Confirmed from an earlier attempt, and Skipped because an invoice already exists. Created and replayed rows open their returned invoice through the existing finance pack. Skipped recipients resolve the matching non-cancelled invoice after an unfiltered dashboard refresh by student, collection, session, and term, with an honest disabled state while resolution is pending. The page clears ledger filters before opening any issuance result, then waits for the reactive unfiltered dashboard row before mounting the finance pack. Saved invoice totals come from the mutation response.
- Added revisioned Admin optional-row management to invoice actions. The UI consumes authoritative `canEditOptionalItems` and `selectionLockReason` values, including allocation-only payment locks. Collection invoices do not show choice controls. Payment handoff actions pass the saved selection revision when required.
- New fee plans with optional rows now send `optionalSelectionMode: "parent_selectable"`. The form requires a positive mandatory base, removes Uniform and Bus Service presets, and separates initial, optional, and maximum totals. Legacy optional rows remain visible in plan details.

## Files changed

- `apps/admin/app/billing/page.tsx`
- `apps/admin/app/billing/types.ts`
- `apps/admin/app/billing/selectable-items-validation.ts`
- `apps/admin/app/billing/fee-plan-validation.ts`
- `apps/admin/app/billing/hooks/useBillingActions.ts`
- `apps/admin/app/billing/hooks/useBillingData.ts`
- `apps/admin/app/billing/components/BankAccountSelection.tsx`
- `apps/admin/app/billing/components/BillingSidebar.tsx`
- `apps/admin/app/billing/components/BillingTabs.tsx`
- `apps/admin/app/billing/components/FeePlanList.tsx`
- `apps/admin/app/billing/components/InvoiceOptionalChoices.tsx`
- `apps/admin/app/billing/components/InvoiceTable.tsx`
- `apps/admin/app/billing/components/SelectableItemsPanel.tsx`
- `apps/admin/app/billing/components/forms/FeePlanForm.tsx`
- `apps/admin/app/billing/components/forms/SelectableCollectionForm.tsx`
- `apps/admin/app/billing/components/forms/SelectableIssuanceForm.tsx`
- `apps/admin/__tests__/billing-selectable-items.test.tsx`
- `apps/admin/__tests__/billing-result-navigation.test.tsx`

## Tests

Added two focused billing test files with eight tests in total. `apps/admin/__tests__/billing-selectable-items.test.tsx` has five component tests:

- invalid collection drafts preserve entered values and identify duplicate labels, invalid prices, and missing class eligibility
- uncertain issuance retries reuse the exact request key and render skipped-existing results
- optional-row saves send the current revision and replace displayed totals with the mutation response
- allocation-only locks render read-only from the authoritative projection even when `amountPaid` is zero and status is issued
- created and replayed result rows open their exact returned invoices, while skipped rows stay disabled during refresh and open the resolved matching invoice

`apps/admin/__tests__/billing-result-navigation.test.tsx` adds three page-level tests proving created, replayed, and skipped callbacks clear an excluding ledger filter and open the resolved finance pack.

## Verification

- `pnpm --filter @school/admin exec vitest run __tests__/billing-result-navigation.test.tsx __tests__/billing-selectable-items.test.tsx`
  - Passed after the filtered-navigation fix: 2 files, 8 tests.
- `pnpm --filter @school/admin test`
  - Passed: 39 files, 178 tests. Existing React `act` warnings remain in `institutional-email.test.tsx`.
- `pnpm --filter @school/admin typecheck`
  - Passed.
- `pnpm exec eslint <B2 Admin files>`
  - Passed with no output.
- `NEXT_PUBLIC_CONVEX_URL=https://placeholder.convex.cloud pnpm --filter @school/admin build`
  - Passed. The first build without the variable compiled and typechecked, then failed while prerendering `/academic/archived-records` because preview mode had no Convex provider.
- `node scripts/audit-theme-colors.mjs`
  - Completed. B2 additions use slate product neutrals and semantic emerald, amber, and rose states. The report also lists existing direct colors in touched billing files and unrelated current-worktree files.
- `git diff --check`
  - Passed.
- `git diff --cached --name-only`
  - Empty. No staged files.

## Residual risk

- The R1 result-navigation blocker is resolved. Every issuance result group now clears excluding ledger filters and continues into the existing invoice finance pack after reactive dashboard resolution.
- The earlier Admin projection gap is resolved. `packages/convex/functions/billing.ts` now returns authoritative `canEditOptionalItems` and `selectionLockReason` fields, including allocation-only locks, and B2 consumes them directly.
- The requested real-backend checkpoint could not run because this worktree has no configured `CONVEX_DEPLOYMENT` or `NEXT_PUBLIC_CONVEX_URL`. Component tests exercise the exact mutation arguments and result states, but a configured B4 environment must verify the created invoice through the live dashboard read path.
