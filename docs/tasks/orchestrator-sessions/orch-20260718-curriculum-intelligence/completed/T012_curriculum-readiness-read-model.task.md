# T012 - Curriculum readiness read model

## Objective

Implement an admin-only bounded readiness query derived from existing topics, curriculum units, artifacts, assessments, and published materials, with focused tests.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add an authenticated admin-only readiness query; never trust a client school ID.
- [x] Filter by school plus optional subject/term/level using indexes and bounded reads.
- [x] Derive per-topic source, lesson plan, student note, assignment, assessment, and student-publication states from existing records.
- [x] Return precise status language and aggregate counts without storing a duplicate readiness table.
- [x] Avoid N+1 client calls and unbounded `.collect()` operations.
- [x] Add focused pure or `convex-test` coverage for tenancy and readiness aggregation.
- [x] Run Convex typecheck, focused tests/lint, and whitespace validation; no deploy.

## Notes

Own a new `packages/convex/functions/academic/curriculumReadiness*.ts` module and focused tests only. Do not edit schema, AI runtime, app files, lifecycle modules, or report-card files. Keep files below 200 lines. Use `apply_patch`; do not stage, commit, or deploy.

## Update 2026-07-18T01:37:05

Second batch implementation.

## Outcome 2026-07-18

Implemented the admin-only calculated readiness read model in `curriculumReadiness.ts` with a small pure aggregation helper and focused Convex test coverage. The query derives school and actor from the authenticated membership, validates optional subject and term filters against that school, and never accepts a client school identifier.

The returned map is bounded to 50 topics and uses indexed, bounded school reads for approved curriculum units, instruction artifacts, assessment banks, and topic-linked materials. It returns explicit preparation evidence only: approved curriculum source, prepared lesson plan/student note/assignment, drafted assessment, and published student resource. It includes the statement that these records do not confirm a topic was taught. No readiness data is stored.

### Verification

- `pnpm exec vitest run functions/academic/__tests__/curriculumReadiness.test.ts` from `packages/convex` — passed (2 tests: factual aggregation and admin tenancy).
- `pnpm --filter @school/convex lint -- functions/academic/curriculumReadiness.ts functions/academic/curriculumReadinessHelpers.ts functions/academic/__tests__/curriculumReadiness.test.ts` — passed.
- `git diff --check` — passed.
- `pnpm --filter @school/convex typecheck` — attempted; currently blocked by unrelated in-progress `functions/academic/curriculumGeneration.ts` errors from T011, where untyped `ctx.db.get` results are inferred as the schema-wide union. The new T012 files produced no typecheck errors.

No files were staged, committed, or deployed.

## Update 2026-07-18T01:47:33

Admin-only bounded readiness read model completed. Focused tests/lint/whitespace pass, and the subsequent full Convex typecheck passed after T011 completed.
