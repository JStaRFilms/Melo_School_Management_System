# Final code acceptance re-review

**Reviewed target:** `c66580a` against residual-review baseline `6b5d3d9`.

**Scope:** only the three residual blockers in `final-code-rereview.md`, using `final-code-rereview-remediation.md` as implementation context. I reviewed the touched functions, schema field, and exact regressions for semantic correctness and checked for newly introduced release blockers only in those touched paths. U7/runtime acceptance remains separate.

## Findings

No release-blocking correctness, tenant-isolation, financial/history-integrity, or regression issue was found in the narrowly reviewed changes.

## Per-item verdicts

### 1. Usage-cycle closing provenance and expiry — RESOLVED

`packages/convex/functions/academic/usageEntitlements.ts:40-67` now provides one bounded provenance-aware calculation for grants and pool allocations at an explicit evaluation time. It rejects foreign-school grant/allocation rows, filters grant expiry, and retains the existing pool meter, entitlement-version, period, active-group, and branch-link checks.

`closeUsageCycle` at `:131-146` evaluates that calculation at the cycle's exclusive `endAt`, compares the reviewed total to the effective-at-close total, and stores the recomputed source breakdown rather than stale denormalized meter allocation fields. Consumption and reservation reconciliation remain tied to the authoritative meter, and source ledger rows remain untouched.

The regression at `usageEntitlements.integration.test.ts:108-192` expires a top-up, exception, and pool before close; rejects stale cumulative totals; verifies effective source values in immutable snapshots; and confirms cumulative provenance remains present. This directly covers the residual defect without weakening rollover or live-availability tests.

**Verdict: PASS**

### 2. Transfer manual level-counter advancement — RESOLVED

`packages/convex/functions/academic/transfers.ts:589-600` now passes `destClass.level` into `commitManualAdmissionNumberHelper` along with the reviewed policy, format, counter key, and counter version. Manual commitment therefore resolves and validates the same level-sensitive counter context used by preview before claiming the number and advancing the counter.

The amended regression at `transfers.integration.test.ts:928-989` configures a JSS1-specific counter, confirms preview selected it, performs manual acceptance and exact replay, verifies the level counter advanced to 10, and verifies the default policy counter remained at 1.

**Verdict: PASS**

### 3. Historical term policy fail-closed behavior — RESOLVED

`packages/convex/functions/academic/migrationAutosave.ts:95-142` now loads the selected term as part of canonical grade evidence and requires it to belong to the selected active session and be active and unarchived. An inactive or archived term therefore cannot be assigned current mutable assessment/grading policy. The same evidence resolver runs during review and commit, so term-state or policy drift remains fail-closed.

`packages/convex/schema.ts:1657-1672` adds only the optional `academicTerms.isArchived` lifecycle field, preserving compatibility with existing rows. The regression at `migrationReviewedImport.integration.test.ts:1332-1361` changes policy between terms and verifies rejection for both inactive and archived selected terms in an otherwise active session.

**Verdict: PASS**

## Regression integrity

The remediation adds focused assertions rather than removing the established behavioral gates. The transfer test replaces default-counter assertions with the stronger level-specific case while retaining authorization, reason, exact replay, claim-count, and audit checks. The usage and grade-import regressions are additive. No focused suite was weakened.

## Checks run

- Four focused Convex integration suites: **52 passed / 4 files passed**
  - `usageEntitlements.integration.test.ts`: 7 passed
  - `commercial.integration.test.ts`: 9 passed
  - `transfers.integration.test.ts`: 17 passed
  - `migrationReviewedImport.integration.test.ts`: 19 passed
- `pnpm --filter @school/convex typecheck`: **passed**
- `pnpm --filter @school/admin typecheck`: **passed**
- `git diff --check 6b5d3d9..c66580a`: **passed**

No Astra, live Convex, provider, deployment, migration, seed, production, credential, server, or external-system operation was performed. Existing unrelated working-tree artifacts were preserved.

## Overall code-review verdict

All three residual code blockers are semantically resolved, their exact regressions pass, and no new release blocker was found in the touched functions.

**APPROVE**
