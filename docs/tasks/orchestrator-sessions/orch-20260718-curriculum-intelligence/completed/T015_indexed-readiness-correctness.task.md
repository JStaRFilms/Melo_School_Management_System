# T015 - Indexed readiness correctness

## Objective

Add status-aware indexes and exact readiness queries so limits cannot hide active or qualifying evidence records.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add compound indexes that put topic scope plus qualifying status/output/visibility fields before limits.
- [x] Query active topics directly through an active-status index before `.take(limit)`.
- [x] Query approved curriculum-unit evidence, active artifacts by output type, active assessments, and approved student-visible materials through exact indexes using bounded `.first()`/`.take(1)` reads.
- [x] Remove post-limit status filtering that can return false negatives.
- [x] Add regressions where retired/non-qualifying records exceed previous limits before valid records.
- [x] Pass Convex typecheck, focused tests/lint, and whitespace checks without codegen/network/deploy.

## Notes

Limit edits to `packages/convex/schema.ts`, readiness modules/tests, and this packet. Coordinate around existing schema changes; preserve them. Use `apply_patch`; do not stage, commit, codegen, install, or deploy.

## Update 2026-07-18T02:05:27

Redispatched from R004.

## Outcome 2026-07-18

Added the five readiness-specific compound schema indexes required to put qualifying state before every bounded read: active topics by exact academic context, approved curriculum units by topic, active artifacts by topic and output type, active assessment banks by topic, and approved student-visible materials by topic.

The readiness query now uses the active-topic index directly and makes exact `.first()` lookups for each qualifying evidence category. It no longer takes a mixed-status result set and filters afterward, so retired topics and non-qualifying records cannot hide a later active or qualifying record.

Expanded the focused Convex regression fixture with 51 retired exact-context topics, 51 proposed curriculum units, 51 archived topic artifacts, 51 archived assessment banks, and 51 unpublished topic materials before the valid records. The valid active topic and all six readiness signals still resolve.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumReadiness.test.ts` from `packages/convex` — passed (2 tests).
- `pnpm --filter @school/convex lint -- functions/academic/curriculumReadiness.ts functions/academic/curriculumReadinessHelpers.ts functions/academic/__tests__/curriculumReadiness.test.ts` — passed.
- `git diff --check` — passed.

No code generation, installation, network access, deployment, staging, or commit was performed.

## Update 2026-07-18T02:12:31

Five qualifying-state indexes and exact first-record readiness queries implemented. Over-limit retired/nonqualifying regressions pass with Convex checks.
