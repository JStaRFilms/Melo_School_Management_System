# T013 - Extraction provenance and lifecycle remediation

## Objective

Move generation to a server-owned action/internal lifecycle, make persistence atomic with success, add return validators/tests, and restore admin build compatibility.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Remove `.ts` suffixes from package imports and pass the admin typecheck.
- [ ] Expose one public action/request whose only business input is `importId`; derive actor, school, provider, model, prompt, schema, and evidence server-side.
- [ ] Make run-start, success+persistence, and failure transitions internal-only; public clients cannot choose provider/model/status.
- [ ] Persist validated proposals and mark the canonical run/import successful in the same server-owned completion transaction.
- [ ] Ensure any generation or persistence failure produces a recoverable failed run/import rather than a stranded `generating` state.
- [ ] Add explicit return validators to all new Convex functions.
- [ ] Add focused auth/provenance/status-recovery and request/route tests.
- [ ] Pass AI/admin/Convex typechecks, focused tests/lint, and whitespace checks without codegen/network/deploy.

## Notes

The preferred trust boundary is a public Convex action with admin auth plus internal queries/mutations; the Next route may be a thin proxy or removed if redundant. `@school/ai` may be linked into `@school/convex` with a minimal lockfile importer entry. Limit edits to the T011 files, new focused action/lifecycle files/tests, relevant package manifests/lock importer, generated API only if it can be refreshed without network, and this packet. Do not run Convex codegen, install, deploy, stage, or touch UI/report-card files.

## Update 2026-07-18T01:52:00

Redispatched from R003.

## Outcome 2026-07-18

- Replaced the forgeable public query/mutation sequence with one public `requestCurriculumGeneration` action whose only business input is `importId`.
- The public action derives the authenticated administrator, school-owned import/source evidence, provider, model, prompt class, and schema contract server-side. Start, completion, and failure transitions are internal Convex functions.
- Completion now validates and persists proposals, writes curriculum units, updates the canonical run to succeeded, and updates the import to ready-for-review in one internal mutation transaction. Any generation or persistence error instead records a failed run/import, preventing a stranded generating import.
- Added return validators to each new public/internal function and made the admin API route a thin authenticated proxy to the single public action.
- Removed `.ts` suffixes from production package imports. The local `@school/ai` workspace junction was absent, so this packet adds the Convex manifest dependency, the minimal lockfile importer entry, and TypeScript aliases only; no install was run.

### Verification

- `pnpm --filter @school/ai typecheck` — passed.
- `pnpm --filter @school/ai test` — passed (5 tests; only the existing Node module-type warning).
- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed (3 tests; existing Convex-test direct-call warnings only).
- `pnpm -C packages/convex exec eslint functions/academic/curriculumGeneration.ts` — passed.
- `pnpm exec eslint apps/admin/app/api/ai/curriculum/import/route.ts` — passed.
- `pnpm --filter @school/ai lint` — passed.
- `git diff --check` — passed (line-ending warnings only).

No codegen, package installation, network call, deployment, staging, or commit was run.

## Update 2026-07-18T02:01:55

Server-owned public action/internal lifecycle remediation complete. AI/admin/Convex typechecks, AI tests, lifecycle tests, lint, and whitespace checks pass; no network commands.
