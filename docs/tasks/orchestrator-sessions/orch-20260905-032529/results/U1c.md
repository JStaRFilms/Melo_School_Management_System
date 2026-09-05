# U1c — Group governance

Status: implemented safe local vertical slice; runtime acceptance E0 / partial. No live linking, migration, Convex CLI, deployment, provider, credentials or commits.

## Routes and contracts
- Platform `/groups`: paginated directory, active/unlinked school selection, canonical HQ-member proprietor selection, explicit branch-slug confirmation, create/link mutation, conflict/retry feedback, immutable owner/HQ directory and separate recovery gate. Discovered from `/schools` layout.
- Admin `/admin/group`: paginated recorded-proprietor directory and metadata-only branches; links to administration/permissions/audit. No aggregate/default feature or cross-school operational navigation is implied.
- `groups.listGroups({paginationOpts})`: Platform all group metadata; active canonical person only their recorded owned groups. Page size <=50.
- `listLinkableSchools({paginationOpts})`: Platform-only safe school ID/name/slug/status/link flag, <=50 per page.
- `listProprietorCandidates({schoolId})`: Platform-only <=100 canonical active HQ members, IDs/names only; overflow explicit. Candidate is not authority until mutation revalidation.
- `createSchoolGroup({name,slug,headquartersSchoolId,proprietorPersonId,confirmation})`: **Platform only**, intended canonical active owner with unique token and active HQ membership; active school; confirmed school slug; unique normalized group slug and unlinked HQ. Writes only group/link + statutory tier1 audit. Never operator-as-owner, identity inference, automatic roles/membership or operational rekeying.
- `linkBranchToGroup({groupId,schoolId,isHeadquarters?,confirmation})`: Platform-only active group/school, confirmed school slug; same link retry idempotent; foreign group rejected. HQ replacement separately gated; no accidental HQ demotion. <=100 branch directory bound.
- `getGroupOverview` / `listGroupBranches`: active recorded proprietor or unique active Platform operator only, not ordinary branch membership. Archived group rejected. Metadata visibility does not confer branch operations.
- `listUserBranches`: canonical suspension/reconciliation fails closed; revoked canonical membership never legacy-falls-back; no school-wide user scan; exact legacy helper only when canonical person absent. Each active school candidate revalidated with U1a resolver; explicit overflow. U1b does not yet mount alternatives or activate switching.

## Ownership handoff U1f/U1g
`schoolGroups._id` owns `proprietorPersonId: persons._id`; `schoolGroupBranches` maps groupId to unchanged schools._id with one initial HQ. Ownership alone allows group metadata, not operational membership. Group has status/settingsVersion; this packet adds no defaults/metrics blob. U1f/U1g must independently authorize each setting/metric source. No schema/generated file/package change.

## Verification and self-review
- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/groups.integration.test.ts`: PASS 4 tests, updated rollout assertions cover explicit owner not operator, proprietor denied linking, retry/duplicate, suspended owner, overview denial, unchanged school documents.
- `pnpm --filter @school/admin exec vitest run __tests__/group-governance.test.tsx`: PASS 2 DOM tests (loading/empty, labelled native select focus/change, denied retry).
- Convex/Admin/Platform `typecheck`: PASS after final tests.
- Focused eslint on groups backend/tests, both route directories and school layout: PASS. `git diff --check`: PASS.
- Ordinary errors fixed: missing required platform fixture authId; incorrect relative imports. No failing check was suppressed.
- Self-reviewed: removed obsolete broad branch-member overview bypass, proprietor arbitrary linking, unbounded identity scans, automatic operator ownership and HQ toggle path. Existing school records unchanged. Form uses native labels/selects and wrapping layout, retains submitted values on mutation failure; duplicate submit disabled. No fake aggregates or branch activation.

## Files / PR boundary
U1c owns `academic/groups.ts`, `academic/__tests__/groups.integration.test.ts`, Platform `app/groups/{page,error}.tsx`, `app/schools/layout.tsx` governance entry, Admin `app/admin/group/{page,error}.tsx`, Admin `__tests__/group-governance.test.tsx`, this result/matrix update. Predecessor files preserved. Permissions/audit navigation destinations are created in next sequential packets; Admin landing discovery is added by U1d.

## Remaining acceptance / U7 request
No authenticated development/browser target was opened. Capture Platform create review/conflict/empty/denied plus Admin metadata at desktop and 320px; verify native keyboard, mutation retry and suspension while open using synthetic tenants. Real ownership/linking rehearsal requires separately authorized reviewed intended owner and safe target. Operational branch navigation stays gated by U1b; shared defaults/aggregates remain U1f/U1g. Platform creation UI has no automated DOM mutation test yet; local backend tests do not replace that evidence.
