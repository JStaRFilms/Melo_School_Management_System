# T010 - First batch integrity remediation

## Objective

Resolve every R001 P1/P2 finding and add real Convex lifecycle coverage before API/UI wiring.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add `curriculum_extraction` to the canonical `aiRunLogs.outputType` validator.
- [x] Replace client-supplied provider/model provenance with a required matching canonical run log.
- [x] Derive provider, model, prompt version, and schema version from trusted server data.
- [x] Validate every supporting excerpt against normalized text from the cited source chunk as well as hash/page membership.
- [x] Add `convex-test` coverage for admin authorization, cross-school rejection, run-log linkage, evidence rejection, audit writes, and idempotent approval retry.
- [x] Run focused tests, Convex typecheck, scoped lint, and whitespace validation.
- [x] Update this packet with exact results; no deploy.

## Notes

Owned by the original Convex implementer. Limit edits to `packages/convex/schema.ts`, the new curriculum modules/tests, and this packet. Preserve the unrelated report-card change. Use `apply_patch`; do not stage, commit, or deploy.

## Update 2026-07-18T01:26:33

Redispatched after independent review.

## Outcome 2026-07-18

Resolved all four R001 findings within the allowed Convex curriculum files.

- `aiRunLogs.outputType` now has its own canonical validator and accepts `curriculum_extraction` without widening lesson and assessment artifact output types.
- Proposal persistence requires a successful, same-school canonical curriculum run linked to the import. The client no longer sends provider, model, prompt, or schema provenance; those values are derived from the run log and the server-owned curriculum schema constant.
- Evidence validation now requires normalized supporting-excerpt text to occur in the cited source chunk, in addition to the existing chunk-hash and page checks.
- Replaced helper-only coverage with a focused `convex-test` lifecycle suite covering admin rejection, cross-school rejection, mismatched run linkage, excerpt rejection, audit writes, trusted provenance, and idempotent approval retry.

### Verification

- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed: 3 tests / 1 file.
- `pnpm --filter @school/convex lint -- functions/academic/curriculumHelpers.ts functions/academic/curriculumImportLifecycle.ts functions/academic/curriculumReviewLifecycle.ts functions/academic/__tests__/curriculumLifecycle.test.ts` — passed.
- `git diff --check` — passed.

No files were staged, committed, or deployed. Deployment remains excluded by this remediation packet.

## Update 2026-07-18T01:34:27

All R001 findings remediated. Convex typecheck, focused 3-case lifecycle suite, scoped lint, and whitespace validation pass.
