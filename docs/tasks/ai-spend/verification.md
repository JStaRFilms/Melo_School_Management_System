# AI spend verification, B1

Status: **not activated**. The new accounting state machine is not connected to either document-generation action or the teacher buttons. Both actions still stop at `assertPaidUsageAvailable()`. Do not deploy this branch as an AI spend activation. The work below is an isolated, tested backend foundation, not the end-to-end implementation in the plan.

## Implemented

- Added a separate assessment task profile and AI attempt fields for a digest, model, expiry, hold, measured tokens, evidence and overage review. Existing generic confirmation still releases disabled tasks.
- Added internal quote, claim, measured settlement, uncertain-outcome and expiry mutations in `aiSpend.ts`, with public owner-only confirmation, status and cancellation. Quoting requires an active contract/cycle, a single AI meter, a matching reviewed model profile and enough allowance below the configured hard stop. Confirmation reserves in one transaction. A claim is once-only; dispatched unknown outcomes retain their hold. Settlement updates the meter, event and attempt together, including zero-use, failure and over-hold measurements. Overages block further quotes and cycle closure until Platform review. Platform can reconcile uncertain use with provider evidence and an audit reason.
- Updated the schema coverage registry for the changed validator shapes. No prompt, excerpt, generated text or private student data is persisted by the new accounting functions. No price is inferred from tokens.

## Not implemented, activation blockers

The provider path is still gated. There is no request-preparing quote action, canonical request digest built from current sources/template/effective settings, re-preparation on dispatch, capped provider call, token aggregation across calls, draft-save idempotency, provider cost evidence, or teacher/Admin/Platform workflow for this route. The internal quote accepts a digest and a caller-provided worst-case minimum from trusted server code but no server caller currently prepares or proves either. It stores neither request arguments nor source text. Existing public AI run-log mutations still accept caller-supplied token counts. Treat them as untrusted and do not use them for billing. Operator review of an uncertain call requires out-of-band provider evidence. Never resolve one by guessing zero or retrying it.

To finish B1, wire the prepared server request through quote, explicit confirmation and an attempt-ID-only dispatch action. Keep the old generation actions gated or remove their public entry points. Cap all provider calls to a reviewed worst-case profile and record reliable token usage for every attempted call before any validation/repair. Settle known used tokens even if saving fails; retain uncertain holds. Add an idempotent result save/recovery path, cost evidence and the three UIs, then add mock-provider action tests for those paths. Re-run all checks and obtain review before activation.

## Checks

- `pnpm install --frozen-lockfile --offline`: passed using local cache. pnpm ignored optional package build scripts; lockfile unchanged.
- `pnpm --filter @school/convex typecheck`: passed.
- `pnpm --filter @school/teacher typecheck`, `pnpm --filter @school/admin typecheck`, `pnpm --filter @school/platform typecheck`: passed.
- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/usage.integration.test.ts functions/academic/__tests__/usageEntitlements.integration.test.ts functions/academic/__tests__/aiSpend.integration.test.ts`: 19 passed.
- Initial full Convex test run before updating schema coverage: 729 passed, 4 failed. Three `demoPreflight.test.ts` failures resulted from the same outdated schema coverage registry as the `schemaCoverage.test.ts` failure. After updating the five validator fingerprints, `pnpm --filter @school/convex exec vitest run schemaCoverage.test.ts demoPreflight.test.ts` passed 17/17. Those failures were caused by this branch, not baseline failures. A subsequent full run confirmed the fix: `pnpm --filter @school/convex test` passed 95 files and 733 tests. No baseline test failures remain.
- `node scripts/audit-theme-colors.mjs`: exited 0. It listed direct colors in unchanged report-card and portal files; those are outside this task. No school-facing UI file was changed here.

## School activation after completion

Platform must publish a new immutable entitlement version with an `ai_tokens` allowance and distinct lesson and assessment profiles for each approved model and the proven worst-case token bound. Link the school's effective contract and start a nonoverlapping cycle with exactly one AI meter. Review mock quote, explicit teacher confirmation, one dispatched provider call, measured token event, failed-use charge, overage and reconciliation controls, and a zero-hold cycle close. Configure the provider key and approved `SCHOOL_AI_*_MODEL` selections only after review. A key alone must not authorize use. Keep OCR and every other unrelated paid gate disabled. No payment or upload gate changes are implied.
