# S0 teacher planning and asset sharing stabilization

## Scope and decision basis

Manually remediated only **F5** and **F7** from `S0-auth-manual-review.md`. The implementation follows the normative H2/F2/H9 boundaries:

- backend operation capability plus branch/resource scope remains authoritative;
- a group link never creates branch membership or branch data authority;
- teacher planning remains bounded by the existing teacher role, assignments, ownership and source visibility;
- asset sharing is an explicit source-branch grant to a named active same-group recipient and does not create membership, download authority or access to recipient records.

No codemod, index operation, commit, role/account migration, Convex CLI/codegen, live provider, server, deployment, migration, production or destructive live storage operation was performed.

## F5 — explicit managed-teacher least-privilege contract

### Contract

Added canonical `academic.planning.use` as the independently delegable managed-teacher planning capability. `TEACHER_PLANNING_CAPABILITIES` accepts either:

1. `academic.planning.use` for least-privilege teachers; or
2. existing `academic.curriculum.manage` as the administrative superset, preserving already-configured managed curriculum operators.

This is an API/route contract only. No ordinary-teacher factory role was added, no existing factory role was widened, and no role assignment/direct grant/account was created or migrated. Proprietor root authority remains the existing catalog-wide ownership rule.

Teacher planning route admission now accepts that any-of contract. Admin knowledge routes still require `academic.curriculum.manage`, so `academic.planning.use` does not admit curriculum administration. Missing planning authority continues to produce the existing authoritative forbidden route state.

The explicit planning contract now covers teacher library/topic/source reads and writes, instruction and assessment draft workspaces/saves/AI-run records, generation rate limits and action pre-authorization, active assessment-profile reads, ingestion/link/OCR/retry operations, and private `curriculum_plan` drafts. Existing admin-only template/profile/curriculum endpoints retain `academic.curriculum.manage` and admin checks.

### Upload separation and UI denial

Knowledge-file upload request and finalization require both the planning any-of contract and independent `assets.upload`. Planning access alone can read/use assigned planning data but cannot request upload authority. The Teacher planning library now replaces upload controls with a clear `assets.upload` denial notice for managed callers lacking that capability; the mobile action opens the same explanation instead of implying upload will work.

### Least-privilege evidence

Focused tests prove:

- a managed teacher with no planning capability is denied planning reads and private planning drafts;
- `academic.planning.use` admits the Teacher route, assignment-scoped subject projection, active profile reads, action authorization projection and private planning drafts;
- planning-only does not admit Admin curriculum routes;
- a teacher holding `academic.curriculum.manage` still cannot pass the downstream Admin role boundary;
- planning-only and curriculum-only teachers are both denied upload;
- planning-plus-upload and curriculum-plus-upload teachers can request an assigned private upload shell;
- an unassigned teacher and an assigned teacher targeting another subject are denied;
- upload controls are absent and the explicit denial is rendered without `assets.upload`.

## F7 — source-authorized explicit same-group sharing

`listShareRecipients` and share grant no longer attempt to authorize the source actor inside each recipient branch. The source actor needs `assets.group_share.manage` only in the source branch; the server then validates the source asset, explicit recipient ID, distinct branches, active schools, active group, same-group linkage and share limit. Revocation remains source-authorized.

This does not grant recipient access to the source actor. `listSharedAssets` still derives an explicit recipient branch membership and requires `assets.library.view` in that recipient branch. The recipient sees only an intentionally reduced shared projection: asset ID, display metadata, MIME/size, timestamps and recorded validation/scan state plus owning-school name. It omits source school/user IDs, uploader/deleter identities, SHA-256, storage references, purge/retention/accounting fields and rollback details. Downloads remain unavailable.

Focused tests prove:

- a source-only operator with no recipient membership can list the safe recipient directory and create the explicit grant;
- that source operator cannot query the recipient's shared-assets view;
- an unrelated branch operator cannot share the source asset;
- common group membership alone exposes no asset;
- a separately authorized recipient sees the asset only after the explicit grant and only through the reduced projection;
- revocation removes the projection immediately.

## Files changed for this stabilization

- Shared capability/route contract and tests: `packages/shared/src/capability-contract.ts`, `workspace-capability-matrix.ts`, `workspace-route-access.ts`, `src/__tests__/workspace-route-access.test.ts`.
- Convex planning/action/draft adoption: `packages/convex/functions/auth.ts`; `academic/rbac.ts`, `drafts.ts`, `documentGeneration.ts`, `lessonKnowledgeTeacher.ts`, `lessonKnowledgeLessonPlans.ts`, `lessonKnowledgeAssessmentDrafts.ts`, `lessonKnowledgeAssessmentProfiles.ts`, `lessonKnowledgeIngestion.ts`, `lessonKnowledgeRateLimits.ts`.
- Asset sharing/projection and tests: `academic/assetWorkspace.ts`, `academic/__tests__/assetWorkspace.integration.test.ts`.
- New focused backend suite: `academic/__tests__/teacherPlanningAuthorization.integration.test.ts`.
- Clear Teacher UI denial and test: `apps/teacher/app/planning/library/page.tsx`, `features/planning-library/components/LibrarySidebar.tsx`, `components/__tests__/LibrarySidebar.test.tsx`.
- Shared-asset projection copy: `apps/admin/app/admin/assets/AssetsWorkspace.tsx`.
- Contract/status records: `capability-route-api-matrix.md`, `results/S0-packet-status.md`, this result.

## Checks run

- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/teacherPlanningAuthorization.integration.test.ts functions/academic/__tests__/assetWorkspace.integration.test.ts functions/academic/__tests__/curriculumTeacherIntegration.test.ts functions/academic/__tests__/drafts.integration.test.ts functions/academic/__tests__/securityAuthority.integration.test.ts functions/academic/__tests__/authorizationRemediation.integration.test.ts`
  - **PASS:** 6 files, 31 tests.
  - Existing Convex direct-function-call warnings appeared only in the pre-existing `curriculumTeacherIntegration.test.ts` fixture.
- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/rbacAudit.integration.test.ts functions/academic/__tests__/auth.test.ts`
  - **PASS:** 2 files, 26 tests.
- `pnpm --filter @school/shared exec vitest run src/__tests__/workspace-route-access.test.ts`
  - **PASS:** 1 file, 15 tests.
- `pnpm --filter @school/teacher exec vitest run features/planning-library/components/__tests__/LibrarySidebar.test.tsx`
  - **PASS:** 1 file, 2 tests.
- `pnpm --filter @school/admin exec vitest run __tests__/assets-workspace.test.tsx`
  - **PASS:** 1 file, 5 tests.
- `pnpm --filter @school/convex typecheck && pnpm --filter @school/shared typecheck && pnpm --filter @school/teacher typecheck && pnpm --filter @school/admin typecheck`
  - **PASS:** all four TypeScript checks.
- Focused ESLint over all touched code files.
  - **PASS with 0 errors and 10 pre-existing unused-symbol warnings in the two touched Teacher planning files.**
- `node scripts/audit-theme-colors.mjs`
  - Informational check completed. New amber colors are semantic permission-warning UI; existing emerald planning status/action colors and report-card colors were reported unchanged.
- `git diff --check` over the stabilization code paths.
  - **PASS**; only Git line-ending conversion warnings were printed.

## Status and remaining boundaries

**F5: resolved locally. F7: resolved locally.** No unsafe policy decision remains for these two findings.

Packet and release status do not advance: all relevant packets remain E0, U5c remains partial for entitlement-bound transport ownership/accounting, search and AV/private-delivery gates, and other findings in `S0-auth-manual-review.md`/R1 retain their own disposition. This work does not claim runtime rollout, role migration, browser acceptance, upload provenance closure (F6), download enablement, AV approval or implicit cross-branch access.
