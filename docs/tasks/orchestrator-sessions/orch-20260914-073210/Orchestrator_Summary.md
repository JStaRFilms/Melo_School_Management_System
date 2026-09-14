# Selectable billing delivery summary

## Status

Implementation and focused review are complete in `feat/selectable-billing-items`.

## Delivered

- School-configured selectable collections for uniforms, books, transport, and similar purchases.
- Class assignment controls eligibility without creating debt.
- Admin collection creation and one/multi-student item issuance with quantities.
- Parent Portal browsing, item selection, positive invoice creation, and payment handoff.
- Parent-selectable optional rows on compulsory invoices start unselected.
- Optional choices recalculate authoritative totals and lock after any payment or allocation.
- Legacy optional invoice rows with missing selection state retain their historical totals.
- Immutable invoice snapshots preserve item name, unit price, quantity, and line amount.
- Same-request retries replay safely; changed payloads conflict; duplicate active collection invoices are skipped or rejected as appropriate.
- Branch duplication, tenant purge, and demo cleanup include the new tables and references.

## Review fixes

The review found and the implementation corrected:

1. Source-tenant bank-account references during branch duplication.
2. Cross-tenant idempotency lookup before student ownership validation.
3. Parent-created invoice state leaking when switching children.
4. Old request keys surviving quantity edits after uncertain submissions.
5. Missing Admin navigation from issuance results.
6. Admin result navigation failing when dashboard filters hid the target invoice.

A focused re-review approved the corrected branch.

## Verification

- Convex focused matrix: 5 files, 29 tests passed before review fixes; affected backend suites passed again after fixes.
- Admin suite: 39 files, 179 tests passed during integration; focused result-navigation tests passed after review fixes.
- Parent Portal suite: 9 focused tests passed after review fixes.
- Convex, Admin, and Portal typechecks passed.
- Admin and Portal production builds passed.
- Focused ESLint checks passed.
- `node scripts/audit-theme-colors.mjs` completed with new branded controls using tenant tokens and semantic colors retained for statuses.
- Convex codegen passed after the authorized development environment files were copied from the admissions worktree.
- Admin and Portal typechecks passed again against the generated bindings.
- `git diff --check` passed.

## Environment setup

The target worktree now has ignored local environment files at the repository root, Admin app, Portal app, and Convex package. Their values were copied from `_w/admissions-recovery`, were not printed, and remain untracked. Dependencies were already installed.

No production deployment command was run. A live browser-to-Convex-to-Paystack acceptance run remains separate from this setup task.

## Integration

The worktree has no staged files and no commit. Review and commit the exact feature files on `feat/selectable-billing-items`. Integrate with a merge commit; do not rebase.
