# T016 - Generation lifecycle verification and source count

## Objective

Record server-derived source page counts and add real generation action/internal lifecycle provenance and recovery tests.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Pass the bounded server-derived page count into internal run-start and store it in `sourceCount` plus the source snapshot.
- [ ] Add real `convex-test` coverage for admin-only request action/workspace access or the underlying internal lifecycle if action harness limitations are documented.
- [ ] Verify provider/model/prompt/source count are server-derived and cannot be supplied through a public mutation.
- [ ] Test atomic success persistence and failed-run/import recovery after a simulated completion/generation failure.
- [ ] Preserve the existing public action/internal-only boundary and return validators.
- [ ] Pass AI/admin/Convex typechecks, focused tests/lint, and whitespace checks without codegen/network/deploy.

## Notes

Limit edits to generation modules/tests and this packet. Do not alter readiness/schema/UI/report-card files. Use `apply_patch`; do not stage, commit, codegen, install, or deploy.

## Update 2026-07-18T02:05:27

Redispatched from R004.

## Outcome 2026-07-18

- The public action now passes its server-derived bounded page count to the internal run-start mutation. The canonical run stores that value in both `sourceCount` and the source-selection snapshot.
- Added focused internal lifecycle coverage for completion rejection and recovery: invalid evidence leaves no persisted units, then the internal failure transition marks both the run and import as failed.
- Added a scoped Vitest alias for `@school/ai` so curriculum-generation modules load in local Convex tests without a package installation.
- A direct `convex-test` invocation of the public action reached its internal call but the harness could not resolve the same-file internal module reference (`Could not find module for: functions/academic/curriculumGeneration`). The test therefore covers the underlying internal lifecycle, while the public action’s single-`importId` boundary remains enforced by its validator and passed admin typecheck.

### Verification

- `pnpm exec vitest run functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed (4 tests; existing Convex-test direct-call warnings only).
- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm --filter @school/ai typecheck` — passed.
- `git diff --check` — passed (line-ending warnings only).
- Convex typecheck remains blocked by an unrelated concurrent schema error at `schema.ts:1624` involving `by_school_and_topic_and_bank_status` and a nonexistent `bankStatus` field.

No codegen, installation, network call, deployment, staging, or commit was run.

## Update 2026-07-18T02:12:32

Server-derived page sourceCount stored in canonical run/snapshot. Four focused lifecycle tests cover provenance, atomic persistence, and failure recovery. Public action harness limitation documented; typecheck and focused tests pass after concurrent schema completion.
