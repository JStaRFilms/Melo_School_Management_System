# U1f — Group defaults: branding slice and remaining contract work

**Status: SAFE LOCAL SCOPE IMPLEMENTED / E0.** Branding and grading retain their existing contracts; U2c owns admission format-only inheritance with branch-owned counters. This U1f follow-up adds typed, immutable defaults and append-only explicit branch choices for role templates, report cards, in-app notifications, academic policy and relative calendar templates, plus their real prospective consumers and one cohesive Admin section. No historical report/calendar/assignment row is rewritten. No migrations/backfills, production reads, providers, live Convex CLI, codegen, deployment, credentials or servers were used.

## Delivered schema and ownership

- `schema.ts`: additive optional `schoolGroups.brandingDefault = {theme, allowBranchOverride, version}` and `schoolGroupBranches.brandingOverride = {mode: inherit|override, theme?, revision}`. No tenant-row rewriting; group/branch IDs remain unchanged. Branding version is independent of legacy `schoolGroups.settingsVersion` and begins at 0 when absent. Schema is authored only, not rolled out.
- `functions/foundation/brandingContract.ts`: reuses the actual two-input school theme shape for existing `schools.theme`, profile mutation and group API validators. Group writes require six-digit hex colors and normalize case. No logo, school name, contacts, domain-semantic grading color or arbitrary JSON store was added.
- `shared/src/group-settings.ts`, exported through `@school/shared/group-settings`: `EffectiveGroupBranding` reuses existing `SchoolThemeInputs`; fields are `theme`, `source: factory|branch_legacy|group|branch_override`, `groupVersion`, `revision`, `mode: legacy|inherit|override`.
- `academic/groupSettings.ts`: helper implementation. Public registrations are in the **already-generated** `academic/groups.ts` module, using typed generated references without hand-editing generated files. Its existing metadata directory/overview now explicitly project metadata, excluding newly added defaults/overrides from Platform directory access.

## Exact API contract

All public references are `api.functions.academic.groups`:

| API | Contract / server authority |
|---|---|
| `getGroupBranding({groupId})` query | One active canonical recorded proprietor without a reconciliation-required flag; active group. Returns group ID/slug, current version and default or null. No Platform-only bypass, ordinary branch member or delegated group-management rollout. |
| `previewGroupBranding({groupId,expectedVersion,theme,allowBranchOverride})` query | Same authority; validates colors and exact version; returns normalized candidate/version, current default and consequence warning. No writes. |
| `saveGroupBranding({...previewArgs,confirmation})` mutation | Repeats same candidate checks in transaction; exact group slug; bounded <=100 group links and recorded HQ journal. Patches only group default/update timestamp; appends permanent tier1 audit with safe before/after colors/version/override policy. HQ metadata is a journal location, not branch operational authority. |
| `getBranchBranding({groupId,schoolId})` query | Active explicit canonical branch membership + `settings.branding.manage`, no Platform support bypass; exact active group/link. Returns effective contract, current group default colors for reset review, branch slug and whether override is allowed. Group ownership alone does not satisfy membership. |
| `saveBranchBranding({groupId,schoolId,expectedVersion,expectedRevision,confirmation,change})` mutation | Same branch authority/link; default must exist; exact group version AND branch revision; exact branch slug. `change` is `{mode:'inherit'}` or `{mode:'override',theme}`. Rejects override when disabled. Patches only link configuration, increments revision and appends permanent tier1 audit. Reset is explicit inherit, not deletion that might reactivate legacy local colors. |

### Resolution / history semantics

`resolveEffectiveTheme(ctx, school)` is a **server helper, not an unauthenticated endpoint**. Caller must establish its own staff/family/public audience authority first.

1. Unlinked/archived group or absent default: existing local theme, otherwise existing factory bases.
2. Active group default + allowed explicit override: explicit branch theme.
3. Allowed overrides + no explicit choice + existing `schools.theme`: preserve legacy branch colors. Merely linking does not silently migrate them.
4. Explicit inherit/reset, or no existing local theme: current group default.
5. Disabling overrides suppresses existing explicit and legacy colors; reenabling can reactivate them. UI preview warns about this policy before confirmation. Reset removes the explicit override, but never rewrites the old school row.

`schoolBranding.getCurrentSchoolBranding` now consumes this helper after its existing authenticated school/family-compatible membership check. Existing current-profile shell consumers receive effective theme values. `updateSchoolProfile` cannot bypass governance by changing local colors on a configured active group: it directs the caller to the reviewed group override workflow and preserves the old local field when other profile fields save. Existing ungrouped behavior stays unchanged. There is **no report-card, invoice, public Sites, notification or historical renderer adoption** here. The helper must never substitute current theme/policy for an issued document snapshot.

## Actual UI

Admin `/admin/group` now mounts `GroupBranding.tsx` after selecting an owned group. It has loading/unconfigured/source/version states; two base inputs; allow-override choice; actual server candidate preview; exact-slug confirmation; pending/failed/retry handling; and branch inherit/override/reset review. Branch choices are intersected with U1c's revalidated `listUserBranches`; backend capability checks remain mandatory. This is an explicitly targeted **configuration form**, not selected operational workspace activation or a header switch. No group link grants access.

Branch query denial has a local retry boundary so it does not hide the independent group-default editor. Remote group/branch revision changes retain edits and require explicit discard/load-latest; they cannot silently update the mutation's expected version. Other domains are listed as not adopted. Full U3a navigation/browser/account dirty guard is not integrated; branch/group selector changes can still discard local in-memory edits. No persistent draft claim.

## 2026-09-05 resume reconciliation

At the 2026-09-05 resume point, no generic group-settings schema or unrelated editor had been added: branding remained unchanged, U2a supplied grading and the other domains were still incomplete. The 2026-09-06 SAFE follow-up below supersedes that historical inventory with closed discriminated validators, immutable version rows and real prospective consumers; it does not introduce arbitrary JSON or duplicate admission counters.

## Per-domain adoption / outstanding work

| Requested domain | Existing source / owner handoff | Actual status / required work |
|---|---|---|
| Branding | `schools.theme`, `schoolBranding`; U3d | **Partial implemented above.** U3d must integrate domain settings UI for non-proprietor branch managers, effective-origin display in its own editor, semantic tokens/public publication/print consumers and shared dirty guard. No general public group configuration API. |
| Grading bands/colors | `gradingBands` + shared exam-recording validation; U2a/U2b | **Implemented subsequently by U2a.** Explicit immutable group-policy references and branch inherit/override resolution reuse the six-band policy and preserve issued-report snapshots; no generic settings blob. See `results/U2a.md` and `results/U2b.md`. |
| Role templates | Existing `roleTemplates` scope/version and U1d immutable creation/evaluator | **Implemented.** Group and branch choices reference immutable scope-checked template IDs; the permission workspace offers only the effective catalogue for future explicit assignment. Group template creation is separate and explicitly says no role is assigned. Existing assignments/evaluator/ceilings are untouched. |
| Admission templates | `admissionNumbers` policies/counters; U2c | **Implemented by U2c and reverified here.** Format-only default plus explicit inherit/override/reset feeds the allocator formatter. Counters, claims, codes and sequences remain branch-owned; historical numbers are unchanged. |
| Report-card templates | Existing term report settings and issued snapshots | **Implemented for approved safe fields.** Typed calculation mode and default days-open feed current report resolution after explicit adoption. Branch/class/term date values remain intact and certified `issuedReportCards.report` snapshots are unchanged. No asset/document-template sharing was inferred. |
| Notification preferences | Portal in-app academic notifications | **Implemented for the real in-app consumer.** Typed switches cover report updates, teacher comments and upcoming events. No provider dispatch, recipient expansion, audit-alert change, email or SMS is implied. |
| Academic policies | `schoolAssessmentSettings` exam input mode | **Implemented.** Effective mode is returned by the real settings API and consumed by report calculation. The legacy writer is blocked while inherit/override is active so it cannot bypass governance. Existing fixed assessment maxima remain domain-owned. |
| Calendar templates | `academicSessions` / automatic term generation | **Implemented prospectively.** Typed non-overlapping relative term templates apply only to a newly created session when automatic terms are requested; fit is revalidated against that branch session. Existing session/term dates are never merged or rewritten. |

The safe requested domain contracts now have real consumers. Remaining gates are external/runtime only for this bounded scope: authorized additive schema/function rollout; authenticated owner/delegated-branch denial and stale-save browser evidence at desktop/320px/keyboard; print/PDF confirmation that certified snapshots stay unchanged; and reviewed public publication if Sites synchronization is ever desired. Static Sites are not synchronized. Shared counters, bank data, provider dispatch, automatic role assignment, calendar merging and historical rewrites remain deliberately unavailable.

## Verification / self-review

Final local bundle (after code/fixture fixes and formatting):
- Convex: `vitest run ...groupDefaultsOverview.integration.test.ts ...groups.integration.test.ts ...rbacAudit.integration.test.ts ...auditExplorer.integration.test.ts ...workspaceAccess.integration.test.ts` — **5 files / 29 PASS**. New combined suite contains **3 branding + 2 overview tests**.
- Admin: `vitest run __tests__/group-defaults-overview.test.tsx __tests__/group-governance.test.tsx __tests__/workspace-shell.test.tsx` — **3 files / 13 PASS**. New suite has **3 branding + 1 overview DOM tests**.
- Convex, Admin, Platform, Shared, Teacher and Portal `typecheck` — **all six PASS**.
- Explicit changed-file eslint — PASS; `git diff --check` — PASS (Windows line-ending notices only). See final handoff for any subsequent rerun.

New tests prove preview is nonmutating, preserve legacy colors, inherit/override/reset source and versions, actual profile query adoption, prevention of legacy profile-write bypass, unchanged school document, statutory audit, owner/member/Platform/outsider boundaries, membership/capability revocation, invalid colors, confirmation and group/branch conflicts, disallowed overrides, and metadata projection. DOM tests prove labels/focus, preview-before-write, group and branch-reset confirmation, exact expected revisions, retained failed/remote-version edits. No synthetic issued invoice/report fixture or calendar policy test was run; historical safety is narrowly supported by inspecting mutation targets and unchanged-school assertions, not a full historical-rendering acceptance claim.

Ordinary fixes: module-map normalization was required by convex-test; invalid fixture status `revoked` was corrected to actual `archived`; direct handler references were replaced with late-bound closures because existing audit↔groups imports exposed circular initialization; required safe actor labels were supplied to the audit writer. No timeout increase, valid-test weakening or error suppression. Existing Vite CJS warning is nonfatal.

Self-review removed raw group-config leakage from metadata APIs, retained canonical membership requirements, avoided generic policy blobs, kept version conflicts transactional, preserved pending edits on remote revisions and isolated branch errors. Added no dependency, migration, generated API hand-authorship, owner recovery, role assignment, provider call or branch activation.

## File boundary / U7 evidence

Created: shared `group-settings.ts`; foundation `brandingContract.ts`; academic `groupSettings.ts`; Admin `GroupBranding.tsx`; combined backend/DOM test files; this result. Modified: schema, Shared package subpath, groups registrations/metadata projection, schoolBranding profile consumer, Admin group page. U1g owns the overview helper/component in the same combined test bundle. Existing predecessor-owned schema/package/group changes remain intact.

**E0:** no browser, authenticated development target or screenshots. U7 must capture synthetic/redacted owner and delegated branch default preview/confirmation, unconfigured, denied/override/reset, stale version and failed save; desktop and 320px, native keyboard and long names. Confirm only an authorized schema/function rollout before runtime use. Print/public publication remain separate evidence/decision gates; screenshots cannot substitute for the implemented calendar/history tests.

## 2026-09-06 SAFE domain-default follow-up

### Serialized schema/API

- Added immutable discriminated `groupSettingVersions` and append-only `branchSettingOverrides`, indexed by group/domain/version and group/branch/domain/revision. Values are closed validators, not JSON: role template IDs, report calculation/default-opened fields, three in-app notification switches, exam input mode, and 1–6 relative calendar terms.
- `groups.get/saveGroupDomainSetting` and `get/saveBranchDomainSetting` expose exact versions, revisions, origin and mode. Group saves require the canonical proprietor and slug. Branch reads/writes require an active exact link, explicit canonical membership and the domain capability; stale pins and disabled overrides fail transactionally. Reset is a new explicit `inherit` revision.
- `groups.createGroupRoleTemplateVersion` creates an immutable group-scoped template from the closed capability catalog and does not create a membership assignment. Role IDs are revalidated against exact group/branch scope on every setting write.
- Admission remains on U2c's dedicated typed format contract. The follow-up adds override/reset/stale/unrelated-branch coverage; it does not move admission data into the new tables.

### Real consumers and history boundary

- RBAC permission workspace resolves the effective future template catalogue; existing `membershipRoleAssignments`, evaluator behavior and delegation ceilings remain unchanged.
- `settings.getSchoolAssessmentSettings` resolves effective exam mode and publishes origin/version/revision. `reportCards` uses that resolver. The legacy local writer refuses to bypass an active inherit/override choice.
- Current report resolution consumes the effective report template. Class/term dates and explicit days-opened rows retain precedence; certified report snapshots are still returned from `issuedReportCards` and setting writes never target them.
- Portal in-app notification construction consumes the effective typed switches. Provider delivery and audit-alert recipients are untouched.
- Automatic term generation consumes a whole effective relative calendar template only for a new session, validating that every generated date fits. It never merges calendars or patches existing sessions/terms.
- Admin `/admin/group` now has one domain selector and consistent default/branch review UI with source, version/revision, inherit, explicit override and reset. `/admin/settings/group-defaults` provides the same branch-choice section to explicitly authorized non-proprietor managers without exposing proprietor default writes. Admission links to its real numbering editor and explicitly states counters remain branch-owned. Branding continues in the adjacent established editor and does not imply Admin-to-Sites synchronization.

### Exact local verification

- Convex focused integration: `groupDomainDefaults`, `admissionNumbers`, `groupDefaultsOverview`, `reportCards`, `rbacAudit` — **5 files / 34 PASS**. The new suite is **7 PASS**, including all five new domains across inherit/override/reset/stale/disabled/unauthorized/unrelated-branch cases, role non-assignment, real consumers, immutable issued report, unchanged existing term rows and invalid/overlapping calendar validation. Admission suite remains **11 PASS** with added override/reset/stale/unrelated coverage; RBAC compatibility remains **8 PASS** after enforcing the effective future-assignment catalogue.
- Admin DOM: `group-defaults-overview.test.tsx` — **1 file / 6 PASS**, including the cohesive typed section, review/slug confirmation, origin/reset labels and branch-owned admission counter boundary.
- Typechecks: Convex, Shared and Admin — **PASS**.
- Focused ESLint for all touched Convex/Admin/Shared source and tests — **PASS**. `git diff --check` — **PASS** (line-ending notices only).
- Informational theme audit ran. New direct tenant colors were not introduced; reported hex values are pre-existing factory branding/test values, existing tenant theme values, product neutrals or semantic warning ink.

### Exact remaining gates

**E0 only for this U1f safe scope:** no live Convex/schema rollout, migration/backfill, authenticated browser, 320px/keyboard, physical print/PDF or production evidence was performed. A future public Static Sites publication contract remains a separate reviewed feature. Shared group counters, bank/account sharing, provider notification dispatch, automatic role assignment, calendar merging and historical report rewriting are explicit exclusions, not incomplete U1f implementation.
