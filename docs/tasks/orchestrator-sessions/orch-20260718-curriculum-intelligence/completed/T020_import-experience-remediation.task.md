# T020 - Import experience remediation

## Objective

Fix indexed source/import reads, no-session state, duration review, labels, and focused regressions.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add a school/sourceType/processingStatus index and query ready imported-curriculum sources before applying a bound.
- [x] Resolve source labels for listed imports by exact material ID so older sources never show unavailable because of selector pagination.
- [x] Add a school/updatedAt import index and return truly recent imports in descending update order.
- [x] Render explicit no-active-session/setup guidance instead of an indefinite loading state.
- [x] Display and edit `suggestedDuration`, including mutation submission.
- [x] Add visible/programmatic labels (`htmlFor`/`id`) for source, subject, level, and term controls.
- [x] Add focused Convex regression coverage with more than the old material limit plus recent-order/source-label assertions.
- [x] Pass admin/Convex typechecks, focused tests/lint, and whitespace checks; no codegen/network/deploy.

## Notes

Limit edits to `packages/convex/schema.ts`, curriculum admin read module/tests, import UI files, and this packet. Coordinate with existing schema changes and preserve them. Keep files under 200 lines. Use `apply_patch`; no stage/commit/codegen/install/deploy/provider calls.

## Update 2026-07-18T02:30:13

Redispatched from R007.

## Outcome 2026-07-18

Fixed the import workspace review findings within the assigned files. Ready curriculum sources now use a source-type/status index before applying the selector bound. Recent imports use their updated timestamp index, and each import resolves its source title directly by material ID. The form now has programmatic labels and a clear no-active-session setup state; review cards show and edit suggested duration.

Added a focused Convex regression that creates more materials than the previous limit and verifies indexed ready-source visibility, exact historical labels, and descending recent-import order.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumAdminRead.test.ts` from `packages/convex` — passed (1 test; existing Convex-test direct-call warning only).
- Scoped Convex and admin ESLint checks — passed.
- `git diff --check` — passed (existing CRLF warnings only).

No code generation, installation, provider/network call, deployment, staging, or commit was run.

## Update 2026-07-18T02:36:21

All R007 import issues fixed with >150-material source/label/recency regression; typechecks/tests/lint/whitespace pass.
