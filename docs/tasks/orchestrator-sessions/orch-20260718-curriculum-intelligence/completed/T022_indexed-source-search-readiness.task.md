# T022 - Indexed source search readiness

## Objective

Move indexed-search eligibility into the source selector index and add the exact over-limit regression.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Extend the ready-curriculum source index through `searchStatus`.
- [x] Query `sourceType=imported_curriculum`, `processingStatus=ready`, `reviewStatus=approved`, and `searchStatus=indexed` before `.take(60)`.
- [x] Add a regression with more than 60 approved/ready but unindexed materials preceding a valid indexed source.
- [x] Pass Convex/admin typechecks, focused test/lint, and whitespace checks.

## Notes

Limit edits to schema, `curriculumAdminRead.ts`, its focused test, and this packet. Use `apply_patch`; no codegen/install/network/deploy/stage/commit.

## Update 2026-07-18T02:38:44

Redispatched from R008.

## Outcome 2026-07-18

Extended the ready-source index through review and search status. The selector query now constrains all eligibility fields in the index before its 60-record bound. The focused regression adds 61 ready, approved, but unindexed source records before a valid indexed source and verifies that the valid source remains selectable.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumAdminRead.test.ts` from `packages/convex` — passed (1 test; existing Convex-test direct-call warning only).
- Scoped Convex and admin ESLint checks — passed.
- `git diff --check` — passed (existing CRLF warnings only).

No code generation, installation, provider/network call, deployment, staging, or commit was run.

## Update 2026-07-18T02:41:57

Indexed-search eligibility moved before selector limit; 61-distractor regression and all local checks pass.
