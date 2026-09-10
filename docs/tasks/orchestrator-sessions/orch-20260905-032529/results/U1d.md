# U1d — Permissions editor and authority safety

Status: safe local vertical slice implemented; partial/E0 pending browser and reviewed membership parity. Executed after U1c verification. No live Convex CLI, migration, seed outside convex-test, provider, credential, production, deployment or commit operation.

## Delivered UI
Admin `/admin/permissions` has authoritative capability denial before editor mount, canonical member selection, composable persisted templates, independent title, categorized native grant/restriction checklists, identical server candidate preview, reason/target confirmation, stale-revision conflict/reload, reversible removal and proprietor-only management ceiling. Template library displays all seven approved factory definitions and creates explicit **new branch template versions** without mutating assigned templates in bulk. Empty canonical directory/catalog requests review rather than seeding roles. `/admin` adds capability-filtered permissions/audit links and group directory discovery. Platform `/groups` retains explicit ownership-recovery/support-evidence gate; no recovery mutation exists.

## Catalog / authority decisions
The actual catalog has 55 accepted entries: 48 canonical capabilities and 7 compatibility aliases. Editor receives the canonical deduplicated catalog from the backend, grouped by domain; no stale D02 count. Seven templates: proprietor, principal, academic_director, exam_officer, bursar, registrar, staff_administrator. Proprietor cannot be assigned through the editor or ordinary role API. Existing explicitly assigned historical proprietor authority remains, with scoped-template validation; archived group ownership no longer grants bypass.

One evaluator now serves persisted and candidate configurations, including template scope, historical factory-key fallback, reviewed legacy principal baseline, canonical alias normalization and restrictions. Restricting a canonical capability also removes its alias grant. Clearing every template may restore the legacy principal baseline; UI explicitly explains it. This is **not** full-admin parity or retirement of legacy domain checks.

All management writes share active branch authority and target checks: anti-self by person/membership, protected proprietor/Platform identity, no delegated peer manager edit, no target capabilities beyond actor's explicit ceiling. Possession is not delegation. Only proprietor/existing Platform support authority may grant/revoke manager capability; ceilings cannot themselves delegate manager authority. No ordinary ownership recovery bypass for Platform writes. Immutable template versions prevent indirect bulk/self/superior edits.

## Public endpoint manifest
All signatures are under `api.functions.academic.rbac`:
- Existing `hasViewerCapability({schoolId,capability})`: boolean server capability check.
- `previewEffectiveCapabilities({schoolId,membershipId,candidateRoleTemplateIds?,candidateDirectGrants?,candidateDirectRestrictions?})`: self read or permission-manager/Platform read, branch-owned target and scoped templates; pure identical evaluator. Candidate read is not permission to save.
- New `getPermissionWorkspace({schoolId})`: permission manager; bounded <=100 members and <=100 templates per global/branch/group scope; overflow explicitly gated. Returns canonical catalog, seven factory definitions, safe member names/IDs/titles, templates and actor ceiling/configuration authority.
- New `getMemberPermissionConfiguration({schoolId,membershipId})`: manager, branch-owned member; assignments, overrides, ceiling, effective result, editable/protected flag, revision, cosmetic title and legacy warning.
- New `saveMemberPermissions({schoolId,targetMembershipId,expectedRevision,displayTitle,roleTemplateIds,grants,restrictions,reason})`: all target/ceiling checks; optimistic conflict, bounded inputs, reason 8–240 chars, no grant/restriction overlap; atomic reversible full configuration replacement. Evaluates resulting access including removal-induced legacy fallback before saving. Patches only membership title/revision, assignment/override rows and statutory tier1 audit.
- New `createRoleTemplateVersion({schoolId,name,capabilities,reason})`: proprietor/Platform authority only, new branch-scoped immutable version; no assignment or global/group mutation.
- Existing `assignRoleToMembership`, `grantDirectCapability`, `restrictDirectCapability`: now use same target/ceiling/scope/catalog protection; ordinary proprietor assignment prohibited; all update revision and audit. Existing optional-reason compatibility retained for old single-change callers.
- Existing `setDelegationCeiling({schoolId,targetMembershipId,allowedCapabilities,expectedRevision?,reason?})`: proprietor/Platform only, protected-target checks, canonical catalog, nondelegable manager authority. Editor supplies revision and reason; old optional argument compatibility retained.

All changed writes append permanent statutory tier1 alerts via existing audit helper. No storage/action/export endpoint or schema addition. Legacy adminLeadership title/ownership records remain untouched; canonical displayTitle is independent.

## Verification / self-review
- Convex focused suites: RBAC/audit 8, groups 4, workspaceAccess 9 = **21 PASS**; RBAC 8 rerun after final owner/version/scope tests and ceiling change.
- Admin `__tests__/permission-editor.test.tsx`: **2 PASS**, loading/denied, native checklist focus, no-write candidate updates, reason/confirmation gating. Rerun after formatting.
- Convex/Admin/Platform typechecks: PASS; Convex/Admin rerun after final ceiling arguments.
- Focused eslint: PASS. Existing Admin landing file reports only its two pre-existing unused imports (useState/X), no errors; not cleaned up unrelatedly. `git diff --check`: PASS.
- A DOM text matcher failed because a summary contains nested text; corrected the test selector, reran successfully. Tail replacement initially hit CRLF mismatch and wrote nothing; corrected line-ending handling and verified the actual replacement. Root prettier command absent; used already installed nested prettier, no download/dependency change.
- Self-review removed duplicate preview logic and three divergent management authorization bodies. Checked resulting-access removal, alias restrictions, protected owner, cross-scope templates, immutable template versions and no title-to-role inference. New tests prove owner version creation/assignment and ceiling, self ceiling denial, foreign-template preview/write denial, removal, revision conflict, peer/manager escalation denial and seven-template contract.

## Files / independent review boundary
U1d: `academic/rbac.ts` (U1a auth contract preserved; evaluator parity hardening necessary for candidate UI), added assertions in `academic/__tests__/rbacAudit.integration.test.ts`, Admin `app/admin/permissions/{page,error}.tsx`, Admin `app/admin/page.tsx` governance links, `__tests__/permission-editor.test.tsx`, this result/matrix. Formatting also applied to U1c-owned new files; remains identifiable by route/module. No generated API hand-authoring, role seed, schema, package or identity migration.

## Gates / U7
No verified support evidence for proprietor recovery: UI explicitly gated, no synthetic recovery authority. No reviewed canonical memberships/legacy full-admin parity claim. U1b still requires compatible default admin shell; capability-only canonical users without that projection remain gated. No branch switching enabled.

Request desktop/320px editor/template library, keyboard details/checklist, protected/self/denied, stale preview, save-failure/retry and review confirmation screenshots. Browser mutation/network/session revocation and template-version lifecycle remain unverified. Full U3a departure/dirty-form guard is not installed; local editor state is not a saved draft. Audit module-scope configuration and recipient-safe visibility are U1e follow-on, not inferred from ordinary capability possession.
