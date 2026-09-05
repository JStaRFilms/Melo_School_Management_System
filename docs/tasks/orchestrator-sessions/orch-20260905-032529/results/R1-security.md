# R1 — CRITICAL 2 / 3 security remediation

## Implemented

- Removed Platform's all-catalog tenant authority, including trusted historical Platform subjects with shadow school-admin rows. Bank, enrollment, assets, permissions, transfers, private form drafts and private import staging no longer accept routine Platform authentication. Explicit Platform group/commercial governance and Platform-authored audit remain independent.
- Added a terminal permission-management marker and configuration detection. Managed/restricted legacy admins cannot fall through to role-only authorization, including after clearing assignments. No automatic migration or role seeding occurred. Only untouched accounts keep old role/assignment compatibility; sensitive RBAC-only APIs do not receive a new blanket legacy grant.
- Added the shared typed capability catalog and [route/API matrix](../capability-route-api-matrix.md). Admin/Teacher navigation and direct URL gates use one contract before private children/subscriptions mount. Adopted legacy enrollment, staffing, billing, assessment/report, configuration, curriculum/planning, draft and upload paths enforce their operation capability. Unmapped legacy APIs/routes, including coarse admin-leadership escalation, deny managed callers instead of bypassing restrictions. Branch switching remains disabled.
- Added `/billing/bank-accounts` with capability-filtered discovery. Platform migration now renders unavailable without mounting private staging.
- Removed transfer's legacy-role/Platform/alternate-capability shortcuts. Acting-branch intake capability is required before state/replay handling.
- Hardened asset Archive reads, removed storage IDs from legacy asset DTOs, and blocked photo/logo/report/Portal/knowledge transports from rebinding, signing or deleting separately governed asset/upload/rollback/candidate storage.
- Updated old success fixtures to use explicitly reviewed tenant operators rather than Platform impersonation. Added direct-call, alias, managed-legacy, cleared-configuration, navigation/direct-URL, Platform, cross-school, storage-bypass and unrestricted migrated enrollment-parity regressions. Migration tests now invoke generated API references, removing their direct-function-call warnings.

## Changed files

Core: `A/auth.ts`, `A/rbac.ts`, `A/migrationAuth.ts`, `A/transfers.ts`, `A/drafts.ts`, `A/assets.ts`, `A/assetWorkspace.ts`, `functions/auth.ts`, `schema.ts`; new `A/assetStorageBoundary.ts`.

Shared: new `capability-contract.ts`, `workspace-capability-matrix.ts`; `workspace-access.ts`, `workspace-route-access.ts`, `workspace-navigation.ts`.

API adoption: `A/studentEnrollment.ts`, `academicSetup.ts`, `adminLeadership.ts`, `adminSelectors.ts`, `teacherSelectors.ts`, `assessmentRecords.ts`, `assessmentEditingPolicies.ts`, `gradingBands.ts`, `settings.ts`, `schoolBranding.ts`, `reportCards.ts`, `reportCardExtras.ts`, `reportCardTermSettings.ts`, `reportCardManualAdjustments.ts`, `historicalTermTotals.ts`; curriculum read/import/review/generation/readiness modules; lesson-knowledge admin/teacher/ingestion/source-proof/templates/profiles/planning/assessment-draft/rate-limit modules; `documentGeneration.ts`; `functions/billing.ts`, `billingProviders.ts`, `portal.ts`. See the matrix for exact gates, including selector and action exceptions.

UI: Admin/Teacher `lib/StaffWorkspace.tsx`; new Admin billing bank-account page; Platform school migration page.

Tests: new `A/__tests__/securityAuthority.integration.test.ts`, `securityFixtures.ts`; updated asset/commercial/email/import/transfer fixtures, migration references, shared route tests and Admin shell tests. Temporary editing scripts were removed from the working tree.

`A/` = `packages/convex/functions/academic/`.

## Checks actually run

- Convex, Shared, Admin, Teacher, Portal, Platform and Sites `tsc --noEmit`: **passed**. Convex rerun after later backend changes also passed.
- Final combined Convex run: **19 files / 161 tests passed**: security authority, auth, identity/tenancy, RBAC/audit, workspace access, bank, numbering, grading, drafts, transfers, assets workspace, commercial/assets, audit explorer, groups, commercial, usage, email/import, migration lifecycle and billing.
- Subsequently added unrestricted migrated enrollment lifecycle parity: security suite rerun **7/7 passed** (the combined run above contained its earlier six tests).
- Shared route/navigation tests **14/14 passed**; Admin actual shell tests **11/11 passed** (including four managed deep-link child-mount denials).
- Focused ESLint on authority helpers, shared contracts/navigation, both shells and new bank page: **passed**.
- `git diff HEAD --check`: **passed** after removing a trailing blank line; Windows LF/CRLF notices remain.
- `node scripts/audit-theme-colors.mjs`: completed informationally. At that point externally staged changes meant it printed only its heading. No direct tenant/status/grade/print colours were introduced or changed by this patch; new route markup inherits existing styling. No global colour replacement was performed.
- Initial checks exposed obsolete Platform-success fixtures, changed transfer capability expectations, fixture typing/DTO errors and one formatting issue. Those were corrected and the relevant suites rerun. Final migration checks emitted **no direct-function-call warnings**. Vite CJS deprecation and Node's existing 30-day test-scheduler overflow warnings remain; passing tests are not runtime scheduler evidence.

## Acceptance and limitations

**Completed:** routine Platform tenant denial; managed legacy restriction enforcement; shared navigation/direct-route contract; per-operation checks on adopted paths; migrated enrollment parity; direct mutation/action/export/storage regression coverage. Existing provider/tenant/assignment/confirmation checks were not replaced by UI hiding.

**Intentionally unavailable:** Platform tenant support/break-glass/proprietor-recovery execution. No public support grant or support-operation consumer exists; none is silently authorized by Platform status. This change does not claim the requested authorized-support fixture with purpose/expiry/replay/revocation/audit outcomes. Such a workflow must be separately implemented before support execution is enabled. Existing explicit Platform governance is not a tenant support grant.

**Still gated/not claimed:** capability-only shells without reviewed legacy projections, selected-branch activation, unmapped legacy-domain adoption, runtime/browser/accessibility/print evidence, schema rollout and reviewed cutover/backfill. Critical 1 import commit correctness, Critical 4 entitlement-bound uploads, and other review findings remain separate blockers; this authorization change does not fix them. Raw legacy uploads are not a unified quota/provider-ownership transport merely because their permission and asset-boundary checks improved.

No live backend, deployment, migration, provider call, production command, dev server, browser authentication or commit was run. Synthetic convex-test storage/provider-result fixtures are local only. The repository index was staged externally during work; this worker ran **no staging or commit commands**. Review the current working tree, not that potentially stale staged snapshot (temporary scripts have since been deleted).
