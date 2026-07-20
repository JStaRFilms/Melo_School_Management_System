# T017 - Canonical generation success test

## Objective

Add the missing successful internal completion and start provenance assertions required by R005.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Start an internal generation with known server-owned provider/model/source count.
- [ ] Assert the running `aiRunLogs` record stores provider, model, sourceCount, and a matching material/page-count snapshot.
- [ ] Complete the generation successfully with valid excerpt-grounded proposals.
- [ ] Assert units are persisted and import/run states become ready-for-review/succeeded atomically with canonical linkage.
- [ ] Keep the existing failure-recovery test.
- [ ] Run the focused lifecycle suite, Convex typecheck/lint, and whitespace check.

## Notes

Limit edits to `curriculumLifecycle.test.ts` and this packet. Use `apply_patch`; no codegen/install/network/deploy/stage/commit.

## Update 2026-07-18T02:15:31

Redispatched to endpoint implementer.

## Outcome 2026-07-18

- Added a successful internal lifecycle test that starts a generation with explicit canonical mock provider/model/source count, verifies the running record and source snapshot, then completes an excerpt-grounded proposal.
- The test verifies atomic success: one proposed unit persists, the run becomes succeeded with token counts, and the import becomes ready-for-review with canonical run linkage and provenance.
- The existing failed completion/recovery test remains in the focused suite.

### Verification

- `pnpm exec vitest run functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed (5 tests; existing Convex-test direct-call warnings only).
- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm exec eslint functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed.
- `git diff --check` from `packages/convex` — passed (line-ending warnings only).

No staging, codegen, installation, network call, deployment, or commit was run.

## Update 2026-07-18T02:17:33

Successful canonical start+complete coverage added. Five lifecycle tests, Convex typecheck/lint, and whitespace validation pass.
