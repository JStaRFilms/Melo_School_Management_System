# Final code re-review remediation

**Scope:** only the three residual blockers in `final-code-rereview.md`.

## Result

All three residual code blockers were remediated with exact focused regressions.

1. **Usage-cycle closing provenance and expiry**
   - `closeUsageCycle` now recomputes allowance sources at the cycle's exclusive end boundary and reconciles the reviewed allocated total against that result.
   - Immutable meter snapshots store effective-at-close base, grace, top-up, exception, pool, and total units. Grant and pool-allocation rows remain the cumulative provenance ledger; they are not treated as effective closing allowance.
   - Grant tenant provenance is revalidated. Existing pool meter/version/period/group/link provenance checks are reused at closure.
   - The regression expires a top-up, exception grant, and group pool before cycle end, rejects stale cumulative closing totals, verifies zero expired source units in the snapshot, and verifies cumulative provenance rows remain intact.

2. **Transfer manual level counter advancement**
   - Destination class level is passed into manual admission-number commitment, so acceptance reselects and revalidates the same level-sensitive counter reviewed by preview.
   - The regression configures a JSS1 counter, verifies that counter was reviewed and advanced, and verifies the default branch counter did not move. Exact replay remains covered.

3. **Historical term policy fail-closed behavior**
   - Grade import evidence now treats an inactive or archived term as historical even when its session is active. Because no immutable term-scoped scoring policy source exists, review and commit fail closed rather than applying current mutable policy.
   - `academicTerms.isArchived` is optional in schema so archived state is explicit without changing existing rows.
   - The regression changes assessment policy between terms and verifies both an inactive prior term and an archived term in the active session are rejected.

## Verification

- Four focused Convex integration suites: **52 passed / 4 files passed**
  - `usageEntitlements.integration.test.ts`: 7 passed
  - `commercial.integration.test.ts`: 9 passed
  - `transfers.integration.test.ts`: 17 passed
  - `migrationReviewedImport.integration.test.ts`: 19 passed
- `pnpm --filter @school/convex typecheck`: **passed**
- `pnpm --filter @school/admin typecheck`: **passed**
- `pnpm --filter @school/convex lint`: **passed**
- `pnpm --filter @school/admin lint`: **0 errors; 112 pre-existing warnings outside the touched files**
- `git diff --check`: **passed**

## Safety boundary

No Astra, live Convex, provider, production, deployment, migration, seed, server, credential, or external-system operation was performed. U7/runtime acceptance was not exercised. Unrelated working-tree artifacts were preserved.
