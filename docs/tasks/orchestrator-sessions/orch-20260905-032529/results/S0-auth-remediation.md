# S0 authorization remediation

## Scope

Manually remediated only findings **F1, F2, F3, F4, F8, and F9** from `S0-auth-manual-review.md`. No codemod was used. The deleted/staged `scripts/r1-*.mjs` files were not recreated, and no index, commit, live service, deployment, migration, provider, credential, or production operation was performed.

## Finding disposition

### F1 — report-card preview no longer authorizes writes

- `saveStudentReportCardComments` and `saveStudentReportCardExtrasEntry` now require `academic.assessments.enter`.
- `academic.report_cards.preview` remains the read contract for report-card and extras retrieval.
- Assignment/form-teacher checks remain authoritative after the capability check.
- Regressions prove preview-only denial and assessment-entry success for managed admins and managed assigned/form teachers, plus unassigned-teacher denial.

### F2 — managed admin-leadership contracts restored without bypassing ceilings

Operation contracts are now explicit:

| Operation | Managed contract |
|---|---|
| List school admins | `staff.list.view` |
| Create school admin | `staff.onboard`; managed actors must also hold `staff.permissions.manage` and be the School Proprietor |
| Promote teacher/admin, demote admin, transfer leadership | `staff.permissions.manage` plus the existing RBAC target/delegation/proprietor boundary |
| Archive/restore admin | `staff.account.suspend`; proprietor lifecycle remains protected |

Untouched legacy-admin compatibility is retained. For managed actors, permission-changing operations resolve the target membership and reuse the existing anti-self-edit, superior/peer, proprietor, and delegation-ceiling rules. Unmigrated peer-admin authority can be changed only by the proprietor. Existing lead-admin, direct-report, self-demotion, archived-target, and school-boundary invariants remain in place.

The create action performs its authority check through one serialized query before any auth provisioning work. Tests cover scoped allow/deny contracts, a denied delegated manager without a ceiling, success after an explicit target-bounded ceiling, proprietor-only creation authority, leadership/direct-report behavior, and proprietor lifecycle denial. The provider-backed provisioning side effect itself was not executed because live/provider operations were prohibited.

### F3 — broad selectors return only minimum context

- `listClasses` now omits form-teacher identity unless the caller also has `staff.list.view` or `staff.assignments.manage`.
- It omits the student-derived count unless the caller also has `enrollment.intakes.manage`; the student table is not queried otherwise.
- `getClassSubjects` omits assigned-teacher identity unless the caller has the narrower staff capability.
- Finance-only and migration-only managed-admin regressions prove the reduced projections.

### F4 — DNS challenges are policy-only

- `getSchoolEmailDomains` returns raw domain rows, including `dnsTxtRecord`, only to `settings.domains.manage` callers.
- Staff-onboarding and enrollment operators receive the safe domain projection used by the email workbench, without challenge/configuration fields.
- Tests cover safe staff projection, raw policy-manager projection, and cross-school denial.

### F8 — exact-capability fixtures and regressions

- Added typed `seedReviewedTenantOperatorWithCapabilities`; the broad all-catalog helper remains only for tests whose assertion is unrelated to least privilege.
- Added `authorizationRemediation.integration.test.ts` with exact capability, role/assignment, school-boundary, projection, leadership ceiling/proprietor, and finance action-chain cases.
- The payment verification and reconciliation actions are tested with `finance.payments.record_manual` alone and denied with `finance.reports.view` alone.

### F9 — reconciliation no longer has an accidental report-read dependency

`reconcilePendingOnlinePayments` now reads payment attempts through a school-bound internal query after its `finance.payments.record_manual` action check. It no longer calls the public report query and therefore no longer implicitly requires `finance.reports.view`.

## Files changed for this remediation

- `packages/convex/functions/academic/adminLeadership.ts`
- `packages/convex/functions/academic/rbac.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `packages/convex/functions/academic/reportCardExtras.ts`
- `packages/convex/functions/academic/academicSetup.ts`
- `packages/convex/functions/academic/institutionalEmail.ts`
- `packages/convex/functions/billing.ts`
- `packages/convex/functions/academic/__tests__/securityFixtures.ts`
- `packages/convex/functions/academic/__tests__/securityAuthority.integration.test.ts`
- `packages/convex/functions/academic/__tests__/authorizationRemediation.integration.test.ts` (new)
- `packages/shared/src/workspace-capability-matrix.ts`
- This result file.

## Checks actually run

- `pnpm --filter @school/convex typecheck` — **passed**.
- `pnpm --filter @school/shared typecheck` — **passed**.
- Focused Convex run covering authorization remediation, R1 authority, RBAC audit, academic selectors, institutional email/import, and billing — **6 files / 41 tests passed**.
- After expanding the per-operation leadership denials, the final authorization-remediation rerun — **1 file / 7 tests passed**.
- Focused ESLint across all implementation/test/shared files touched by this remediation — **passed**.
- `git diff HEAD --check` — **passed**; only existing Windows LF/CRLF notices were printed.
- `node scripts/audit-theme-colors.mjs` — completed informationally. It reported direct colours in pre-existing report-card code (`#0f172a`, `#d97706`); this remediation did not add or alter those colours.
- `git status --short -- scripts/r1-*.mjs` — no working-tree script paths; none were recreated.
- Vite emitted its existing CJS deprecation warning during passing tests.

## Explicitly unresolved / not claimed

- **F5 managed-teacher planning parity remains unresolved.**
- **F6 legacy upload provenance and unique claim binding remains unresolved.**
- **F7 group asset-sharing recipient contract remains unresolved.**

No completion claim is made for F5, F6, or F7. No runtime/browser/accessibility/print, schema rollout, migration, provider, deployment, or production evidence was gathered.
