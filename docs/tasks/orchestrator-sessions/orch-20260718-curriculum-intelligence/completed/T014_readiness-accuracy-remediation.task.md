# T014 - Readiness accuracy remediation

## Objective

Eliminate cutoff-induced false readiness results by using exact academic context and topic-indexed bounded evidence reads, with regression tests.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Require exact `subjectId`, `termId`, and normalized `level` context for the first-release readiness query.
- [x] Validate the selected subject and term belong to the authenticated admin's school.
- [x] Query topics through the exact school/subject/level/term index before applying a bounded limit.
- [x] Load source/artifact/assessment/publication evidence through topic-scoped indexes so older matching records cannot disappear behind a school-wide cutoff.
- [x] Keep the result bounded and avoid client-side N+1 calls or duplicate readiness storage.
- [x] Add regression coverage with distracting earlier school records proving matching context/evidence remains accurate.
- [x] Pass Convex typecheck, focused tests/lint, and whitespace checks without codegen/network/deploy.

## Notes

Limit edits to the T012 readiness modules/tests and this packet. Do not edit schema, AI, endpoint, generated API, UI, lockfile, lifecycle modules, or report-card files. Use `apply_patch`; do not stage, commit, codegen, or deploy.

## Update 2026-07-18T01:52:00

Redispatched from R003.

## Outcome 2026-07-18

Remediated the T012 post-limit and school-wide evidence cutoff issues within the readiness modules only. The query now requires `subjectId`, `termId`, and a non-empty normalized level; it validates the subject and term against the authenticated admin's school before querying the exact `schoolId + subjectId + level + termId` topic index.

Each returned topic loads curriculum-unit, instruction-artifact, assessment-bank, and student-published-material evidence through its own school/topic index. All topic and evidence reads remain bounded, the client still makes one query, and no readiness record is stored. This prevents unrelated older school records from consuming a global evidence cutoff.

The focused Convex regression test now seeds 401 earlier active artifacts on an unrelated topic before creating the matching Mathematics topic. The matching readiness row still contains all six positive preparation signals, proving the exact-context and topic-indexed paths are used.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumReadiness.test.ts` from `packages/convex` — passed (2 tests).
- `pnpm --filter @school/convex lint -- functions/academic/curriculumReadiness.ts functions/academic/curriculumReadinessHelpers.ts functions/academic/__tests__/curriculumReadiness.test.ts` — passed.
- `git diff --check` — passed.

No code generation, installation, network access, deployment, staging, or commit was performed.

## Update 2026-07-18T02:01:55

Exact-context topic-indexed readiness remediation complete. Cutoff regression with 401 distracting records passes alongside Convex checks.
