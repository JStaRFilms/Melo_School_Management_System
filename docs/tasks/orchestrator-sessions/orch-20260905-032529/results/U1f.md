# U1f — Group defaults: branding slice and remaining contract work

**Status: PARTIAL / E0. The packet definition of done is NOT complete.** A real branding default/override API, UI and profile consumer are implemented and locally verified; U2a subsequently added the approved grading reference/default contract. Six other requested domains still have no effective group resolver. These are remaining implementation work, not external-access blockers or completed inheritance. No migrations/backfills, production reads, providers, live Convex CLI, codegen, deployment, credentials, servers or commits were used. Existing U1a–e changes were preserved.

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

No new generic group-settings schema or unrelated editor was added in the resume. The existing branding effective contract remains unchanged; U2a's already-committed grading reference/default implementation supersedes the earlier grading-not-implemented row below. Admission numbering and the other domain defaults remain incomplete unless their existing domain contracts can own versioning, history and prospective resolution without a duplicate JSON store. They were not guessed into U1g or branch selection.

## Per-domain adoption / outstanding work

| Requested domain | Existing source / owner handoff | Actual status / required work |
|---|---|---|
| Branding | `schools.theme`, `schoolBranding`; U3d | **Partial implemented above.** U3d must integrate domain settings UI for non-proprietor branch managers, effective-origin display in its own editor, semantic tokens/public publication/print consumers and shared dirty guard. No general public group configuration API. |
| Grading bands/colors | `gradingBands` + shared exam-recording validation; U2a/U2b | **Implemented subsequently by U2a.** Explicit immutable group-policy references and branch inherit/override resolution reuse the six-band policy and preserve issued-report snapshots; no generic settings blob. See `results/U2a.md` and `results/U2b.md`. |
| Role templates | Existing `roleTemplates` scope/version and U1d immutable creation/evaluator | **Not implemented in group-default governance.** Reuse scoped immutable templates; explicit assignment is still required. A group default must never assign roles or expand delegation ceilings/membership by itself. |
| Admission templates | `admissionNumbers` policies/counters; U2c | **Not implemented.** Owner must fix session-year/reset/version lifecycle and adopt prospective formatter resolution. Group template is not permission to share counters or rename historical admission numbers. |
| Report-card templates | Existing report config/assets; U2b/U3c | **Not implemented.** Need approved immutable domain template/version and issued-report snapshot boundary; no raw document/config duplication. |
| Notification preferences | Domain-specific notifications/audit alert recipients | **Not implemented.** Need approved typed preference/recipient resolver. No provider dispatch or audit-recipient broadening. |
| Academic policies | Legacy `settings.ts` assessment settings | **Not implemented.** Need domain-approved policy validators, immutable version ownership and effective caller adoption. No second generic assessment-policy store. |
| Calendar templates | Academic sessions/terms | **Not implemented.** Need typed relative template and separately validated branch date application; retain branch dates and enforce session/term ranges. No calendar writes or calendar-date acceptance tests were added. Overview UTC filter validation is NOT calendar-template validation. |

The six still-missing domain implementations, their immutable historical consumers, delegated group-management authority, branch manager entry outside the proprietor directory, and U3a guards remain acceptance gaps. They are not being marked complete because the branding contract exists.

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

**E0:** no browser, authenticated development target or screenshots. U7 must capture synthetic/redacted owner default preview/confirmation, unconfigured, branch denied/override/reset, stale version and failed save; desktop and 320px, native keyboard and long names/colors. Confirm only an authorized schema/function rollout before runtime use. Token/print/public adoption and calendar/history acceptance remain separate work, not screenshots that can prove missing code.
