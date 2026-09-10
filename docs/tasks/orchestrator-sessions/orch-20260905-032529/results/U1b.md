# U1b — Workspace shells, navigation and denied routes

**Status: partial / locally verified, updated by the U1b Teacher follow-up.** Default-workspace integration remains delivered. Admin selected-school activation remains limited to its closed explicit-school allowlist. Teacher selected-school activation is now available only for Exam Entry and Subject Selection; every other Teacher route and every legacy Admin route outside the existing allowlist still fails closed. No deployment, migration, Convex CLI, live backend, credentials, provider, server, Astra, or browser authentication command was used.

## U1b Teacher follow-up — explicit assessment and enrollment chains

- Teacher now uses the same account-ID-scoped selected-school persistence and two-stage session revalidation as Admin: `groups.listUserBranches({})` discovers active candidates and `getViewerAccess({schoolId})` authoritatively revalidates the target. A stale/revoked persisted ID mounts no route data, is removed only for the next session, and does not affect another account's storage key.
- The only newly switchable Teacher routes are **`/assessments/exams/entry` and descendants** plus **`/enrollment/subjects` and descendants**. Their complete mounted chains pass the active `schoolId`: Teacher session/term/class/subject selectors; exam sheet read and bulk score write; enrollment matrix read and subject-selection write; shell branding and assignment preflight. The server resolves membership again and checks school-owned entities plus the selected branch's exact teacher class/class-subject assignments.
- Branch switching awaits U3a `requestDeparture({kind:"branch"})`. Stay/save failure leaves the current branch in place. Approval persists the target and replaces the current URL with the route pathname, clearing exam entity query parameters before the target subtree can mount. The account+branch-keyed navbar remount clears enrollment component state; access/branch mismatches render only the loader or denial, never old records beneath a new branch label.
- Navigation/direct admission is capability-aware and assignment-aware. A selected route requires canonical membership and its exact capability (`academic.assessments.enter` or `enrollment.intakes.manage`). A branch with no active assigned class gets a direct denial and no Teacher route links, while retaining the validated selector so the teacher can leave that branch. Per-class and per-subject calls retain backend assignment denial.
- **Still unsupported, switch-disabled, and truthfully labelled:** Teacher `/assessments/exams` landing, `/assessments/report-card-workbench`, `/assessments/report-cards`, `/assessments/report-card-extras`, and all `/planning` routes (`/planning`, lesson plans, question bank, library, videos). Their report/draft/generation/storage/usage chains still contain legacy projection or no-school calls. Admin gained no new route in this follow-up: support remains exactly `/admin/audit`, `/admin/permissions`, `/admin/assets` (including Archive/Trash), `/admin/settings/admission-numbering`, `/admin/settings/email-domains`, and `/assessments/setup/grading-bands`. Transfer, dashboard, people, general settings, report, billing, import and knowledge routes remain unavailable while selected.
- No `users.schoolId`, identity, role, membership, assignment, or domain row is changed by switching. Tests assert separate branch teacher projections/assignments, cross-branch selector/read/write denial, unchanged legacy user school ownership, stale selection cleanup, dirty Stay, URL clearing after approval, no stale-data flash, capability/assignment direct denial, unsupported direct URLs and revocation.

Follow-up verification: Teacher shell/selection **7 PASS**; Shared route/navigation **20 PASS**; Convex workspace/enrollment **14 PASS**. Convex, Shared, Admin and Teacher typechecks passed. Focused changed-file ESLint passed with no output; `git diff --check` passed with line-ending notices only. Theme audit was informational: the touched enrollment colours are existing semantic warning colours; remaining navbar literals are existing product-neutral/status seams. No browser/320px screenshot or authenticated runtime claim is made.

## 2026-09-05 resume update — actual branch activation

- Admin now loads `groups.listUserBranches`, persists only a school ID under an account-ID-scoped localStorage key, and revalidates both the directory and `getViewerAccess({schoolId})` each session. Hydration and target changes unmount route content until the requested summary matches; revoked/stale persisted targets fail closed and are removed for the next session. The user can explicitly return to the default branch.
- The active selector is enabled only on `/admin/audit`, `/admin/permissions`, `/admin/assets` (including Archive/Trash), `/admin/settings/admission-numbering`, `/admin/settings/email-domains`, and `/assessments/setup/grading-bands`. These mounted callers pass the selected `schoolId` and enforce their own server capability/resource checks. `schoolBranding.getCurrentSchoolBranding` gained an optional, server-resolved school argument for the shell adapter.
- All other Admin routes and every Teacher route remain switch-disabled. If a persisted nondefault selection opens an unscoped route, the shell mounts no child data, exposes no target-labelled legacy data, and offers return to default. Selected-branch navigation contains only allowlisted routes the current target capabilities admit.
- Branch changes await the existing U3a `requestDeparture({kind:'branch'})` save/discard/stay contract. Rejection stays put; failures are announced. No `users.schoolId`, Better Auth identity, role, membership, or data row is mutated.
- New local coverage: account-scoped hydration/reset/revocation cleanup, selected-summary and branch-list validation, strict canonical membership/capability admission, safe-nav projection, guarded selector switching, target-scoped branding, and unscoped-route blocking.
- Final combined rerun: Shared workspace policy/navigation **19 PASS**; Admin selection/shell plus group suites **22 PASS**; Convex group/access/RBAC bundle **28 PASS**. Convex, Shared, Admin, Teacher, Portal and Platform typechecks passed. Focused changed-file ESLint passed with zero warnings; full Admin lint passed with zero errors and 115 pre-existing warnings. `git diff --check` passed (line-ending notices only). The informational theme audit classified touched direct colors as existing product-neutral/status or tenant-theme test fixtures; no global replacement was made.

## Decisions and delivered behavior

- Admin and Teacher consume U1a `workspaceAccess` before subscribing to default branding or mounting page children. Server denial is terminal UI, not an unauthorized redirect/loading loop. Missing legacy projection/default equality explicitly requests reconciliation; a canonical capability array or display title cannot substitute for legacy route parity.
- Preserve previous shell admission: Admin requires reviewed default legacy `role=admin`; Teacher accepts reviewed default legacy `teacher` or `admin`. Do not broaden these entire route families from `legacyIsSchoolAdmin` or a principal capability baseline. Individual backend admin-flag and teacher assignment checks remain unchanged.
- Branding is fetched through the real generated `schoolBranding.getCurrentSchoolBranding({})` reference only after access passes. Missing/mismatched/nonactive branding blocks children. A loading/denied/revoked summary unmounts domain content; the navbar subtree is keyed by account and validated school. This is not proof of a future cross-account/branch cache-reset protocol.
- `getLegacyWorkspaceAccess` and `getWorkspaceModuleDenial` feed both actual shell decisions and navbar projection. Existing Admin billing, curriculum-import/readiness and knowledge-library module gates remove links from the DOM and block nested direct URLs. Route matching now respects segment boundaries. No invented URLs or guessed per-domain RBAC mappings were added.
- Module availability remains distinct from authorization. These inherited UI feature gates are **not a new backend entitlement enforcement claim**, and the old dashboard may still request default billing summaries. No universal domain-capability parity claim is made.
- `AuthoritativeForbiddenView` supports unauthenticated, suspended, forbidden, reconciliation-required and module-disabled states without inventing branch metadata or missing capabilities. Portal keeps `portal.canAccessPortal` and family/selected-child authority; false access gets a real denial view instead of redirecting to another sign-in loop. Branding waits for Portal access. No Portal staff branch selector was added.
- Current authoritative branch is displayed beneath the navbar header. The account-scoped selector is enabled only on the exact Admin and Teacher scoped-route allowlists documented above; unsupported routes keep the switching-unavailable explanation and never mount selected context. Switching persists only a validated school ID and never mutates identity.
- Shared `BranchSwitcher` uses a labelled native select for future validated multi-branch callers, filters suspended options, and renders no selector for zero/single/disabled choices. The native control replaces the incomplete custom listbox/search keyboard implementation. Current staff shells deliberately pass no alternatives. Header branch information is in a separate wrapping row to avoid squeezing 320px navigation; actual reflow is unverified.

## Branch-directory prerequisite (resolved before activation)

The original implementation correctly refused to mount the then-unhardened `groups.listUserBranches`. U1c subsequently removed the school-wide fallback, bounded canonical identity/membership discovery, filters inactive schools, and revalidates candidates through `resolveActiveMembership`. Admin and Teacher now consume that hardened directory only as discovery and independently require `getViewerAccess({schoolId})` before mounting selected context. Group linkage alone remains non-authoritative.

## Shell / route / caller adoption manifest

| Shell / routes (all descendants unless noted) | Access and actual caller behavior | Switched-branch support |
|---|---|---|
| Admin `/admin` (`/admin/dashboard`, `/admin/settings`, existing administration page) | `apps/admin/lib/StaffWorkspace.tsx`; default U1a summary + conditional default branding. Existing dashboard still calls `academicSetup.listTeachers/listClasses/listSubjects/listSessions`, `billing.getBillingDashboard({})`, events/audit selectors. Existing leadership page still calls default leadership/teacher APIs. | **Blocked**; no domain argument adapter |
| Admin `/academic` (students/onboarding/import alias, teachers, classes, subjects, sessions, events, archive, knowledge) | Same shell, full-bleed retained. Existing students page uses default class/session selectors and student enrollment mutations, uploads and owned-record operations. Knowledge route feature gates share nav policy. | **Blocked**; no storage/action/internal-chain adoption |
| Admin `/assessments` (results/entry, cards/extras/backfill/manual adjustments, setup) | Same shell, full-bleed retained. Existing record/config/report callers unchanged; child mount waits for default compatibility. | **Blocked**; no report/export/print scope assertion |
| Admin `/billing` | Same shell, existing module gate retained through shared decision. Existing billing hooks/forms/actions unchanged. | **Blocked**; no finance/provider caller adoption |
| Admin `/students/import` | **New layout**, same full-bleed shell. Existing page still gets default branding and supplies its schoolId to `DataMigrationWorkbench`; its downstream migration/import chain was not promoted to switched-safe. `/academic/students/import` remains covered by Academic. | **Blocked**, even though the workbench accepts schoolId |
| Teacher `/assessments`, `/enrollment`, `/planning` | `apps/teacher/lib/StaffWorkspace.tsx`; account-scoped validated selection. Exam Entry and Subject Selection pass explicit school through selectors and domain read/write calls and preflight an active class assignment. Planning and report-card chains remain unchanged/default-only. | **Supported only:** `/assessments/exams/entry`, `/enrollment/subjects`. **Blocked:** exam landing, all report routes, all planning routes. Membership is never an all-classes permission. |
| Portal `(portal)` `/`, `/results`, `/report-cards`, `/billing`, `/notifications`, `/learning/topics` and nested topics | Existing `portal.canAccessPortal({})` retained; branding only after true. Family/selected-child scope unchanged. Student-only learning nav remains projected from Portal role. | Not a staff workspace; **no branch switching** |

**Exact API adoption (superseded by the follow-up above):** Teacher selectors now accept an additive optional `schoolId`; Exam Entry and Subject Selection always supply it. `assessmentRecords.getExamEntrySheet`, `assessmentRecords.upsertAssessmentRecordsBulk`, `studentEnrollment.getClassStudentSubjectMatrix`, and `studentEnrollment.setStudentSubjectSelections` likewise accept additive optional `schoolId` for compatibility and receive it from every mounted caller on those enabled Teacher routes. No action, storage, export, planning, report-card, or other legacy signature was promoted.

### Exclusions

Sign-in, switch-areas, payment-return/callback routes outside these families, app roots/providers, Platform and Sites are unchanged. The existing unconfigured/demo shell bypass is preserved; authoritative gating described here applies to configured clients. No proposed groups/permissions/audit/commercial/assets route was added. Portal child selection and existing teacher assignment code were not rewritten. U1a’s auth/backend files and package manifest were not edited.

## U3a integration seam (not full guard acceptance)

`WorkspaceNavbar` now accepts:
- `requestDeparture: (WorkspaceDeparture) => Promise<boolean>`;
- `onNavigate(href)` for an approved same-origin link (actual shells supply `router.push`);
- `onBeforeUnload(event)` and `onPopState(event)` lifecycle callbacks, registered/removed together;
- async `onSignOut`.

`WorkspaceDeparture` (exported through shared index) models `link`, `router`, `workspace`, `branch`, `account`, `sign_out`. The navbar capture handler covers ordinary links within its subtree (including page links), respects modifier/new-tab/download actions, awaits approval, suppresses duplicate pending departures, stays on false/rejection and announces failure. Both navbar sign-out buttons use the same awaited seam. Browser callbacks are attachment points only: **a popstate callback cannot itself undo browser history**.

U3a subsequently installed its provider/hooks in both staff app seams. Branch selection now awaits that real guard before changing persistence or clearing route entity parameters; existing link/sign-out integration remains shared. Arbitrary raw Next router interception and real-browser Back/Forward behavior remain outside this follow-up's claim.

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
- **Still blocked by domain adapters:** Teacher planning/report-card/exam-landing chains and Admin routes outside the exact allowlist above. Their selectors/actions/storage/export dependencies are not all explicitly school-scoped, so selection remains disabled and selected direct URLs fail closed.
- **E0 runtime:** request synthetic/redacted desktop and **320px** screenshots for Admin dashboard + disabled billing + revoked/import/reconciliation states, Teacher assessment/planning denied states, and Portal family denial/student-vs-parent learning navigation. Capture native selector keyboard behavior on an approved scoped route only after it exists. Test navbar open/close focus, wrapped branch explanation, sign-out error/guard modal and save-failure/stay; browser Back/reload belongs to U3a integration. No screenshot or authenticated runtime claim is made here.
