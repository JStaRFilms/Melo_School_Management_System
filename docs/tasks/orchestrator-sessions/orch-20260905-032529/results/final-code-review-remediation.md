# Final code review remediation result

**Reviewed finding source:** `final-code-review.md`
**Code baseline:** `bef3cae`
**Remediation head before this result:** `0ca9039`

## Result

All five concrete code release blockers identified by the final review are remediated in source with focused regressions. No live Convex, Astra, deployment, migration, seed, server, credential, production, or external-provider operation was performed.

| Finding | Resolution | Regression evidence |
|---|---|---|
| Meter-specific/current group allocations | Effective allowance now boundedly resolves pool provenance and counts only the requested meter when the entitlement version, active group/branch link, and effective period still match. | Multi-meter isolation, archived-group provenance, and post-expiry assertions in `usageEntitlements.integration.test.ts`. |
| Repeatable usage cycles | Added explicit Platform-only end-boundary closure, reviewed meter-balance reconciliation, zero-reservation proof, immutable per-meter closing snapshots, closed-cycle state, and clean singleton activation for the next cycle. | Rollover test rejects a live reservation, closes at the end boundary, preserves prior balances, and activates a zero-consumption next cycle. |
| Correction idempotency and void semantics | Normalizes an accepted idempotency key once for lookup and insertion. A void must negate the complete current effective balance after prior monetary corrections. | Whitespace-normalized replay plus void-after-credit and void-after-debit tests. |
| Transfer numbering intent | Acceptance and its replay intent now carry policy, format, counter key/version, exact proposed number, and sequence. Automatic allocation revalidates all fields atomically; manual counter advancement receives the complete reviewed configuration. Admin forwards the preview unchanged. | Stale-format, stale-counter, exact replay, and successful explicit manual-counter-advance coverage in `transfers.integration.test.ts`. |
| Reviewed grade imports | Review and commit validate current/historical student-class evidence, reject derived aggregate subjects, resolve canonical academic and grading policy, validate scores and derive totals/grades through `@school/shared/exam-recording`, persist reviewed policy snapshots, and reject changed or unavailable evidence. Historical rows without an immutable scoring-policy source remain intentionally fail-closed. | Same-school mismatched class, raw40, raw60 scaling, configured band, aggregate subject, out-of-range score/total, stale policy, and unavailable historical-policy tests. |

The paid generation/OCR gates and provider entry points were unchanged from `bef3cae`; provider execution remains fail-closed.

## Commits

- `c48f19f` — `fix(u5): reconcile usage cycles and invoice corrections`
- `83ff0c3` — `fix(u6): bind transfer acceptance to numbering review`
- `bee721c` — `fix(u4): enforce reviewed grade import evidence`
- `0ca9039` — `fix(u5): validate active pool group provenance`

## Verification

- Focused Convex integration suite: **50 passed / 4 files passed**.
- `pnpm --filter @school/convex typecheck`: **passed**.
- `pnpm --filter @school/admin typecheck`: **passed**.
- `pnpm --filter @school/convex lint`: **passed**.
- `pnpm --filter @school/admin lint`: **completed with 0 errors and 112 pre-existing warnings outside the touched transfer page**.
- `node scripts/audit-theme-colors.mjs`: **completed; informational, no files changed**.
- `git diff --check f6fc7c4`: **passed** after removing only the reviewed trailing whitespace from `docs/features/ProductWideModuleEntitlements.md`.
- Diff review confirmed no changes to `paidUsageGate.ts`, `documentGeneration.ts`, or `lessonKnowledgeIngestion.ts`.

## Exact residual blockers

**Residual blockers from the five reviewed code findings: none.**

The independent U7/runtime gates remain unchanged and were not exercised:

1. The approved-development-target allowlist is absent.
2. The active shell lacks `CONVEX_DEPLOYMENT`.
3. The Apply runtime is absent.
4. Root Playwright remains unsafe for this acceptance scope until an isolated no-seed/no-server/no-trace configuration is reviewed.
5. Paid external generation/OCR and commercial provider capabilities remain intentionally unavailable/unverified.
