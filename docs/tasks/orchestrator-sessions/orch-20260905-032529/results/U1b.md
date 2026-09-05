# U1b — Workspace shells, navigation and denied routes

**Status: partial / locally verified.** Default-workspace integration is delivered. **No staff route is enabled for switched-branch data.** Selected-school persistence/activation and final U3a guard handshake remain gated. No commits, deployment, migration, Convex CLI, live backend, credentials, provider, server, or browser authentication commands were used. Pre-existing U1a changes were preserved.

## Decisions and delivered behavior

- Admin and Teacher consume U1a `workspaceAccess` before subscribing to default branding or mounting page children. Server denial is terminal UI, not an unauthorized redirect/loading loop. Missing legacy projection/default equality explicitly requests reconciliation; a canonical capability array or display title cannot substitute for legacy route parity.
- Preserve previous shell admission: Admin requires reviewed default legacy `role=admin`; Teacher accepts reviewed default legacy `teacher` or `admin`. Do not broaden these entire route families from `legacyIsSchoolAdmin` or a principal capability baseline. Individual backend admin-flag and teacher assignment checks remain unchanged.
- Branding is fetched through the real generated `schoolBranding.getCurrentSchoolBranding({})` reference only after access passes. Missing/mismatched/nonactive branding blocks children. A loading/denied/revoked summary unmounts domain content; the navbar subtree is keyed by account and validated school. This is not proof of a future cross-account/branch cache-reset protocol.
- `getLegacyWorkspaceAccess` and `getWorkspaceModuleDenial` feed both actual shell decisions and navbar projection. Existing Admin billing, curriculum-import/readiness and knowledge-library module gates remove links from the DOM and block nested direct URLs. Route matching now respects segment boundaries. No invented URLs or guessed per-domain RBAC mappings were added.
- Module availability remains distinct from authorization. These inherited UI feature gates are **not a new backend entitlement enforcement claim**, and the old dashboard may still request default billing summaries. No universal domain-capability parity claim is made.
- `AuthoritativeForbiddenView` supports unauthenticated, suspended, forbidden, reconciliation-required and module-disabled states without inventing branch metadata or missing capabilities. Portal keeps `portal.canAccessPortal` and family/selected-child authority; false access gets a real denial view instead of redirecting to another sign-in loop. Branding waits for Portal access. No Portal staff branch selector was added.
- Current authoritative branch is displayed beneath the navbar header with an explicit switching-unavailable explanation. No alternative branch controls, local selection state, localStorage persistence, identity mutations, or reauthentication-based switching were introduced. Persistence without any approved switchable route would create a misleading target context, so it remains a follow-up rather than a cosmetic implementation.
- Shared `BranchSwitcher` uses a labelled native select for future validated multi-branch callers, filters suspended options, and renders no selector for zero/single/disabled choices. The native control replaces the incomplete custom listbox/search keyboard implementation. Current staff shells deliberately pass no alternatives. Header branch information is in a separate wrapping row to avoid squeezing 320px navigation; actual reflow is unverified.

## Why `groups.listUserBranches` is not mounted yet

Read the real query in `packages/convex/functions/academic/groups.ts`, not just its declared return type. It currently collects active memberships without applying the U1a active-person/duplicate-target checks; an empty canonical membership result falls back to a school-wide legacy-user scan. School status metadata can also include suspended branches. It must not be treated as equivalent to the authoritative summary, nor should a UI expose these candidates merely because they share a group.

U1b did **not** edit U1c-owned group governance to hide this prerequisite. Since every current staff route remains default-only anyway, it shows only the one branch actually returned by `getViewerAccess({})`. U1c must harden discovery, and U1b/domain follow-up must revalidate any selected target through `getViewerAccess({schoolId})` before activation. Zero/multi-branch *component* tests below are not production branch-discovery acceptance.

## Shell / route / caller adoption manifest

| Shell / routes (all descendants unless noted) | Access and actual caller behavior | Switched-branch support |
|---|---|---|
| Admin `/admin` (`/admin/dashboard`, `/admin/settings`, existing administration page) | `apps/admin/lib/StaffWorkspace.tsx`; default U1a summary + conditional default branding. Existing dashboard still calls `academicSetup.listTeachers/listClasses/listSubjects/listSessions`, `billing.getBillingDashboard({})`, events/audit selectors. Existing leadership page still calls default leadership/teacher APIs. | **Blocked**; no domain argument adapter |
| Admin `/academic` (students/onboarding/import alias, teachers, classes, subjects, sessions, events, archive, knowledge) | Same shell, full-bleed retained. Existing students page uses default class/session selectors and student enrollment mutations, uploads and owned-record operations. Knowledge route feature gates share nav policy. | **Blocked**; no storage/action/internal-chain adoption |
| Admin `/assessments` (results/entry, cards/extras/backfill/manual adjustments, setup) | Same shell, full-bleed retained. Existing record/config/report callers unchanged; child mount waits for default compatibility. | **Blocked**; no report/export/print scope assertion |
| Admin `/billing` | Same shell, existing module gate retained through shared decision. Existing billing hooks/forms/actions unchanged. | **Blocked**; no finance/provider caller adoption |
| Admin `/students/import` | **New layout**, same full-bleed shell. Existing page still gets default branding and supplies its schoolId to `DataMigrationWorkbench`; its downstream migration/import chain was not promoted to switched-safe. `/academic/students/import` remains covered by Academic. | **Blocked**, even though the workbench accepts schoolId |
| Teacher `/assessments` (nested exams layout remains pass-through), `/enrollment`, `/planning` | `apps/teacher/lib/StaffWorkspace.tsx`; default teacher/admin compatibility. Planning full-bleed retained. E.g. planning still uses `teacherSelectors.getTeacherAssignableClasses/getTeacherActiveTerms/getTeacherAssignableSubjectsByClass` and lesson-knowledge queries/mutations. Server class/subject/form-teacher assignment authority unchanged. | **Blocked**; membership is not an all-classes permission |
| Portal `(portal)` `/`, `/results`, `/report-cards`, `/billing`, `/notifications`, `/learning/topics` and nested topics | Existing `portal.canAccessPortal({})` retained; branding only after true. Family/selected-child scope unchanged. Student-only learning nav remains projected from Portal role. | Not a staff workspace; **no branch switching** |

**Exact API adoption:** the shell branding call is now typed, conditional, and checked against the summary's branch. No public mutation/action/storage/export signature was changed. The U1a no-argument summary subscription remains in AuthProviders unchanged. There is **no selected-school allowlist** and no branch argument added to domain callers. Above are conservative route-family gates with representative actual callers, not claims that complete action→internal chains were audited.

### Exclusions

Sign-in, switch-areas, payment-return/callback routes outside these families, app roots/providers, Platform and Sites are unchanged. The existing unconfigured/demo shell bypass is preserved; authoritative gating described here applies to configured clients. No proposed groups/permissions/audit/commercial/assets route was added. Portal child selection and existing teacher assignment code were not rewritten. U1a’s auth/backend files and package manifest were not edited.

## U3a integration seam (not full guard acceptance)

`WorkspaceNavbar` now accepts:
- `requestDeparture: (WorkspaceDeparture) => Promise<boolean>`;
- `onNavigate(href)` for an approved same-origin link (actual shells supply `router.push`);
- `onBeforeUnload(event)` and `onPopState(event)` lifecycle callbacks, registered/removed together;
- async `onSignOut`.

`WorkspaceDeparture` (exported through shared index) models `link`, `router`, `workspace`, `branch`, `account`, `sign_out`. The navbar capture handler covers ordinary links within its subtree (including page links), respects modifier/new-tab/download actions, awaits approval, suppresses duplicate pending departures, stays on false/rejection and announces failure. Both navbar sign-out buttons use the same awaited seam. Browser callbacks are attachment points only: **a popstate callback cannot itself undo browser history**.

U3a must install its provider/hooks in the app seams, pass these callbacks, and route imperative router/workspace/account actions outside navbar clicks through the same request function. Shell props currently do **not** supply a draft guard. Existing links/sign-out retain legacy behavior until that hookup; branch switching stays unavailable regardless. Browser reload/back restoration, dirty stay/discard/save-failure, cross-tab session reset and account-switch protocol require U3a acceptance. No draft storage or guard-framework implementation was duplicated here.

## Local verification

Final commands:

```text
pnpm --filter @school/shared exec vitest run src/__tests__/workspace-navigation.test.ts src/__tests__/workspace-route-access.test.ts
  PASS: 2 files, 9 tests
pnpm --filter @school/admin exec vitest run __tests__/workspace-shell.test.tsx
  PASS: 1 file, 7 tests
pnpm --filter @school/convex exec vitest run functions/academic/__tests__/workspaceAccess.integration.test.ts
  PASS: 1 file, 9 tests (existing U1a backend suite)
pnpm --filter @school/admin typecheck
pnpm --filter @school/teacher typecheck
pnpm --filter @school/portal typecheck
pnpm --filter @school/shared typecheck
  PASS: all four, rerun after final code changes
pnpm exec eslint <all U1b changed TS/TSX implementation and test files, excluding the one-line shared index export>
  PASS (explicit changed-file command executed twice)
git diff --check
  PASS
```

Coverage: legacy role preservation without capability-baseline parity; zero/single/multiple branch component behavior; suspended option removal; native selector focus/change; revoked/reconciliation/loading nav pruning; mismatch target cannot mount old records or a target header; Admin module-disabled deep link/no child mount; import link discovery; Portal navigation separation; segment-boundary matching; async link rejection/failure/approval; sign-out approval; browser callback registration/cleanup. Backend U1a tests re-prove local summary/membership denial and assignment boundaries, **not full UI-domain parity**.

One initial DOM run failed due to jsdom lacking `scrollIntoView`; installed a test-only stub and reran successfully. Two exact-edit calls were rejected for duplicate match regions and were reissued with unique context; no partial patch was relied upon. Ordinary missing-file inspection paths were corrected by reading actual configs/locations. Vite’s existing CJS deprecation warning is nonfatal. No checks were silenced or backend/provider invoked.

## Files / self-review

Created: Admin/Teacher `lib/StaffWorkspace.tsx`, Admin import layout, shared `workspace-route-access.ts`, shared policy tests, Admin `workspace-shell.test.tsx`, this result. Modified: seven existing staff layouts, Portal layout, shared navigation, navbar, branch switcher, forbidden view and shared index. Updated coverage matrix. Temporary layout-generation script removed.

Self-review: consolidated repeated staff shells instead of retaining divergent guards; kept Admin vs Teacher import seams local while sharing all access policy; retained full-bleed differences and legacy admission; removed custom incomplete listbox and fake capability diagnostics; added no dependency, backend writes, schema, generated API, or title-to-role mapping. Configured staff descendants are either admitted to their validated **default** or blocked before mounting. No persistence/target-header work was smuggled in as branch support.

## Acceptance remaining / U7 evidence requests

- **Partial now:** default-workspace shell/navigation/direct-URL states, default branch context, inactive target controls removed, Portal authority preserved, departure callback seam.
- **Blocked pending U1c/domain adapters/U3a:** safe branch list, selected-school account-scoped persistence and per-session revalidation, full query/entity reset, target suspension/revocation during an actual switch, actual selected-branch teacher/admin operations, complete draft/router/browser/account departure behavior.
- **E0 runtime:** request synthetic/redacted desktop and **320px** screenshots for Admin dashboard + disabled billing + revoked/import/reconciliation states, Teacher assessment/planning denied states, and Portal family denial/student-vs-parent learning navigation. Capture native selector keyboard behavior on an approved scoped route only after it exists. Test navbar open/close focus, wrapped branch explanation, sign-out error/guard modal and save-failure/stay; browser Back/reload belongs to U3a integration. No screenshot or authenticated runtime claim is made here.
