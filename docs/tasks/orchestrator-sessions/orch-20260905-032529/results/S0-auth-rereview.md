# S0 authorization remediation rereview

## Verdict

**Authorization stabilization: ACCEPTED.** In the current final worktree, F1-F5 and F7-F9 are resolved. F6 is resolved for stabilization by an honest server-side fail-closed gate; uploads are still unavailable and are not represented here as a completed feature.

No remaining write-by-preview path, managed/legacy capability bypass, teacher assignment or ownership widening, cross-school/group authority escalation, Platform-to-tenant fallback, or test-fixture masking was found in the focused F1-F9 rereview.

This verdict is limited to S0 authorization stabilization. It does **not** close broader R1 security, storage-feature, rollout, migration, provider, browser, accessibility, print, or other non-authorization findings.

## Review basis

- Reviewed HEAD: `44086fa005db6adaf161ef2ddb070bc8a8a14d6c`.
- The index is stale and was not treated as authoritative. At fetch time:
  - final tracked worktree versus HEAD: 312 paths, 23,767 insertions / 7,208 deletions;
  - index versus HEAD: 307 paths, 23,695 insertions / 6,802 deletions;
  - unstaged tracked delta: 46 paths, 794 insertions / 1,128 deletions;
  - untracked paths before this report: 13.
- The review used the final filesystem contents, the three remediation reports, the original F1-F9 report, and focused source/helper/test tracing. It did not restart the whole-program audit.
- No index, commit, deployment, migration, provider, credential, production-data, or live-service operation was performed.

## Per-finding disposition

### F1 — RESOLVED: preview cannot write report-card child records

**Endpoints checked**

- `packages/convex/functions/academic/reportCards.ts:1068` — `saveStudentReportCardComments` admits with `academic.assessments.enter` at line 1079, validates student/session/term school binding, then preserves teacher class assignment and admin-role checks.
- `packages/convex/functions/academic/reportCardExtras.ts:611` — `saveStudentReportCardExtrasEntry` admits with `academic.assessments.enter` at line 621, preserves form-teacher/admin edit authority, and validates student/class/session/term binding before writes.

A focused search found `academic.report_cards.preview` only on report-card/extras read paths in these files, not on the two write mutations. Exact-capability tests deny preview-only managed admins and teachers, allow assessment-entry admins and assigned/form teachers, and deny an unassigned teacher.

### F2 — RESOLVED: admin-leadership operations have explicit managed contracts

**Public endpoints checked in `packages/convex/functions/academic/adminLeadership.ts`**

| Endpoint | Final managed contract and retained boundary |
|---|---|
| `listSchoolAdmins` (line 47) | `staff.list.view`; active-school admin role remains required. |
| `getCreateSchoolAdminAuthority` (line 139) | `staff.onboard`; managed callers additionally need `staff.permissions.manage` and proprietor authority. |
| `createSchoolAdmin` (line 166) | Action first requires `staff.onboard`, then invokes the serialized authority query before provider work. No provider operation was executed in this review. |
| `promoteTeacherToAdmin` (line 281) | `staff.permissions.manage`; school target, anti-self/target review, proprietor and delegation ceiling checks are applied through `assertPermissionManagementTargetForLegacyUser`. |
| `promoteSchoolAdmin` (line 324) | `staff.permissions.manage`; target/delegation checks plus existing direct-report and lead-state rules. |
| `demoteAdminToTeacher` (line 375) | `staff.permissions.manage`; target/delegation checks plus existing lead-only, non-self, non-lead-target rules. |
| `archiveSchoolAdmin` (line 461) | `staff.account.suspend`; school, self, current-lead, archived-state, and proprietor lifecycle protections remain. |
| `transferSchoolAdminLeadership` (line 510) | `staff.permissions.manage`; target/delegation checks plus current-lead and direct-report requirements. |
| `restoreSchoolAdmin` (line 577) | `staff.account.suspend`; school, archived-state, and proprietor lifecycle protections remain. |

`packages/convex/functions/academic/rbac.ts:422-502` keeps managed targets fail-closed: self edits, reconciliation-required identities, Platform identities, proprietors, targets outside a non-owner's ceiling, and unmanaged peer-admin authority are rejected. Untouched legacy-admin compatibility remains the explicit fallback; managed callers cannot use it to avoid the target checks.

The focused regressions use operation-specific actors, exercise all leadership endpoint denials for a directory-only actor, prove missing-ceiling denial and explicit-ceiling success, proprietor-only create authority, lifecycle-only archive/restore, and proprietor lifecycle denial. Manual body review found no capability check occurring after a tenant write.

### F3 — RESOLVED: broad academic context selectors redact narrow data

- `packages/convex/functions/academic/academicSetup.ts:1721` — `listClasses` returns form-teacher identity only with `staff.list.view` or `staff.assignments.manage`, and returns/queries student counts only with `enrollment.intakes.manage`.
- `packages/convex/functions/academic/academicSetup.ts:2234` — `getClassSubjects` validates the class belongs to the active school and returns teacher identity only with the same narrow staff capabilities.

Finance-only and migration-only exact-capability tests prove that `formTeacherId`, `formTeacherName`, `teacherId`, `teacherName`, and `studentCount` are absent. The shared context array remains any-of admission; it no longer implies those narrower projections.

### F4 — RESOLVED: DNS challenge/configuration data is policy-only

`packages/convex/functions/academic/institutionalEmail.ts:363` returns raw domain rows only when `emailAccess` establishes `settings.domains.manage`. Staff-onboarding and enrollment callers receive the explicit safe projection; `dnsTxtRecord` and other raw configuration fields are omitted. The email workbench separately maps domains to the same non-challenge shape. Tests prove safe staff projection, raw policy-manager projection, and cross-school denial.

### F5 — RESOLVED: managed-teacher planning has a least-privilege authorization seam

- `packages/shared/src/capability-contract.ts:4,79-83` defines canonical `academic.planning.use` and `TEACHER_PLANNING_CAPABILITIES = [academic.planning.use, academic.curriculum.manage]` as an any-of contract.
- The Teacher route uses that any-of contract; planning-only authority does not admit Admin curriculum routes.
- Teacher library, lesson-plan, assessment-draft/profile, generation-rate-limit, action preauthorization, ingestion, and private `curriculum_plan` draft paths use the shared planning contract. Existing role, assignment, source visibility, material ownership, and school checks remain downstream.
- Upload request/finalization still additionally requires `assets.upload`; after both capability and assignment/resource checks, the current final worktree reaches the F6 unavailable-transport gate instead of creating a shell or issuing a URL.

Exact managed-teacher tests cover no-capability denial, planning-only assigned access, unassigned and wrong-subject denial, no Admin curriculum admission, curriculum-manager backward compatibility, and independent upload capability. No factory role or live account was changed; explicit grant/template assignment remains an operational rollout concern rather than an authorization bypass.

### F6 — RESOLVED FOR STABILIZATION; UPLOAD FEATURE REMAINS CLOSED

This disposition accepts the requested fail-closed safety gate, not upload completion.

- `packages/convex/functions/academic/assetStorageBoundary.ts:7-19` centralizes the explicit unavailable response because generic URLs cannot prove tenant/caller/purpose provenance, reserve quota before transfer, or guarantee abandoned-upload cleanup.
- Asset intent/finalization, logo issuance/binding, student-photo issuance/new binding, staff knowledge issuance/finalization, Portal supplemental issuance/finalization, and PDF-candidate intake reach the gate. Authorization and resource/assignment checks remain before the gate where those paths have caller/resource context; the gate is before claim, shell, accounting, audit, processing, or URL side effects.
- A search of `packages/convex/functions/**/*.ts` found no `generateUploadUrl` call.
- `assertStorageUnclaimed` checks all listed owning purposes before future/internal claims. `assertStorageClaimedOnlyBy` protects destructive asset, rollback, candidate, logo, derived-knowledge, and cleanup paths. Compatibility reads reject asset/quarantine bindings and conflicting ownership; historical zero-claim snapshots remain explicitly compatibility-only.

Focused tests prove no URL/intent/material shell or quota mutation, denial of generic-ID finalization across all caller paths, preservation of historical bindings, global duplicate-claim rejection, and terminal cross-tenant/revoked-capability denial. Secure upload transport, reservation, provider enforcement, and cleanup are still mandatory future work before any gate removal.

### F7 — RESOLVED: sharing is an explicit source grant, not dual membership

In `packages/convex/functions/academic/assetWorkspace.ts`:

- `listShareRecipients` (line 110) requires `assets.group_share.manage` only in the source school and returns only active same-group branches.
- `setBranchShare` (line 129) requires source capability and source asset ownership, then validates a distinct active recipient in the same active group; it creates no membership or recipient authority.
- `listSharedAssets` (line 153) independently requires `assets.library.view` in the recipient school, revalidates active group/source state, and returns reduced metadata without storage IDs, uploader/hash/lifecycle/accounting fields, or download authority.

Exact tests prove source-only grant/revoke, no recipient access for the source actor, outsider denial, no implicit group exposure, explicit recipient visibility, reduced projection, and immediate revocation.

### F8 — RESOLVED: least-privilege evidence no longer depends on catalog-wide actors

`seedReviewedTenantOperatorWithCapabilities` is used by the dedicated F1-F5/F7/F9 regressions. Assertions are made with preview-only, assessment-entry-only, finance-only, migration-only, directory-only, permission-only, lifecycle-only, planning-only, source-share-only, and recipient-library-only actors as appropriate.

The broad `seedReviewedTenantOperator` remains in unrelated lifecycle/state tests, but it is not the evidence for the remediated operation contract. The storage authorization-ordering test also explicitly revokes `assets.upload`, so the expected denial is not masked by the base fixture.

### F9 — RESOLVED: payment reconciliation has no accidental report-read requirement

`packages/convex/functions/billing.ts:2274` requires `finance.payments.record_manual`, derives the authenticated school through `getViewerContext`, and calls the school-bound internal query at lines 2301-2306. `listBillingPaymentAttemptsForReconciliationInternal` at line 1395 reads only attempts for that supplied authenticated school. The action no longer calls public `listBillingPaymentAttempts` and therefore does not require `finance.reports.view`.

Exact tests allow a payment-only managed admin to run the empty reconciliation scan and deny a report-only admin both verification and reconciliation.

## Cross-cutting regression assessment

- **Managed versus legacy:** managed missing-capability paths continue to fail closed; no new `membershipOnly` or `legacyOperation` escape was introduced in these endpoint contracts. Legacy untouched accounts retain the reviewed compatibility behavior.
- **Any-of semantics:** the academic context and teacher-planning arrays are used as any-of admission. Independent requirements such as planning plus `assets.upload` are checked separately and therefore remain all-of only where intended.
- **Teacher scope:** assignment/form-teacher and material/source ownership checks remain after capability admission; exact unassigned/wrong-subject tests pass.
- **Platform boundary:** `getContextCapabilities` yields no tenant capabilities for Platform identities, and the focused Platform suite proves ordinary tenant operations and legacy shadow-account fallback remain terminally denied while explicit Platform governance remains available.
- **Tenant/group scope:** school IDs are derived or checked before sensitive reads/writes; sharing validates source ownership and same-group recipient state without conferring branch membership.
- **Tests:** no relevant denial was changed into a broad-authority success assertion. The new tests strengthen, rather than weaken, the original security evidence.

## Checks run against this final worktree

1. `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/authorizationRemediation.integration.test.ts functions/academic/__tests__/teacherPlanningAuthorization.integration.test.ts functions/academic/__tests__/storageSafety.integration.test.ts functions/academic/__tests__/assetWorkspace.integration.test.ts functions/academic/__tests__/securityAuthority.integration.test.ts`
   - **PASS:** 5 files, 27 tests.
2. `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/curriculumTeacherIntegration.test.ts functions/academic/__tests__/drafts.integration.test.ts functions/academic/__tests__/auth.test.ts functions/academic/__tests__/rbacAudit.integration.test.ts`
   - **PASS:** 4 files, 34 tests.
   - Existing direct-Convex-function-call warnings appeared in the curriculum integration fixture.
3. `pnpm --filter @school/shared exec vitest run src/__tests__/workspace-route-access.test.ts`
   - **PASS:** 1 file, 15 tests.
4. `pnpm --filter @school/convex typecheck`
   - **PASS**.
5. Focused manual searches:
   - no `generateUploadUrl` under `packages/convex/functions`;
   - no remaining report-card child-record mutation admitted by `academic.report_cards.preview`;
   - all teacher planning consumers use the shared planning any-of contract or intentionally retain Admin-only curriculum authority;
   - all F2 public endpoints have explicit operation contracts and downstream target/lifecycle checks.

Vite printed its existing CJS API deprecation warning during the passing test runs.

## Separately open work

- Upload transport/provider provenance, pre-transfer entitlement reservation, provider size enforcement, single-use settlement, and abandoned/failed upload cleanup remain required before uploads can be enabled.
- No schema/index rollout, data migration, role assignment, live account, or provider verification was performed.
- Broader findings in `R1-security.md`, `review-findings.md`, packet reports, and non-authorization acceptance work retain their existing status. This S0 authorization acceptance does not supersede them.

## Decision

No S0 authorization blocker remains in F1-F9 in the reviewed final worktree. Resume may treat the authorization-stabilization gate as satisfied, while keeping the disabled upload feature and all broader R1/non-auth work explicitly open.

**APPROVE**
