# T006 - Convex curriculum import lifecycle

## Objective

Implement the curriculum import and unit schema, admin-only lifecycle functions, source evidence validation, topic approval idempotency, audit logging, and focused tests.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add bounded/indexed `curriculumImports` and `curriculumUnits` schema records.
- [x] Add admin-only import creation, proposal persistence/review, and idempotent topic approval.
- [x] Validate actor school, source readiness/type, subject, term, level, and evidence references server-side.
- [x] Extend canonical AI/content audit validators only as required by this feature.
- [x] Add focused pure or Convex tests for normalization, authorization boundaries, and approval idempotency.
- [x] Keep new code modular; no new file approaches 200 lines.
- [x] Record verification commands and results in this task file.

## Notes

Own `packages/convex/schema.ts` and new `packages/convex/functions/academic/curriculum*` files. Do not edit `packages/ai`, app routes, or unrelated existing files. Preserve the user's report-card change. Use `apply_patch` for edits. Do not deploy.

## Update 2026-07-18T01:11:49

Delegated to a balanced-tier implementer.

## Outcome 2026-07-18

Implemented the T006 Convex lifecycle in the assigned schema and new `curriculum*` modules only. The implementation creates imports only from ready, approved, school-owned `imported_curriculum` sources; verifies the subject and active term belong to the actor's school; requires chunk-hash/page evidence; records duplicate warnings; and creates or links a `knowledgeTopics` record exactly once per approved unit.

Schema additions keep import/unit records separate and bounded, add only the curriculum references needed on canonical AI-run and content-audit records, and add indexed school-scoped lookup paths.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm --filter @school/convex lint -- functions/academic/curriculumHelpers.ts functions/academic/curriculumImportLifecycle.ts functions/academic/curriculumReviewLifecycle.ts functions/academic/__tests__/curriculumHelpers.test.ts` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumHelpers.test.ts` from `packages/convex` — passed (4 tests: normalization, cross-school/non-admin boundary, evidence matching, idempotency/status derivation).
- `git diff --check` — passed.

No deployment was run: this delegated packet explicitly prohibits it. The project-level deployment requirement remains for the parent handoff step.

## Update 2026-07-18T01:22:11

Convex schema and modular import/review lifecycle completed. Focused tests, typecheck, lint, and whitespace validation passed; deployment deferred to final release gate.
