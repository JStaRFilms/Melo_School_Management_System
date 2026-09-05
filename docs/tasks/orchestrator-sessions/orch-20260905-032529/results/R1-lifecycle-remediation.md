# R1 lifecycle remediation — warnings 6–9

## Outcome

Warnings 6–9 are fixed in local source and regression tests on `feat/melo-expansion-productization`. `results/S0-git-stabilization.md`, the R1 findings and the stabilized commits were inspected first: S0 had serialized the stack and contained Critical 4, but none of these four lifecycle defects was already fixed, so no S0 work was duplicated. This work remained non-live: no Convex development or production backend, provider, deployment, migration, seed, credential, or stored production object was accessed.

All packet/runtime evidence remains E0. The additive schema and cron changes require a separately authorized development rollout before runtime acceptance.

## Implemented slices and commits

| Slice | Commit | Local change | Follow-up PR boundary |
|---|---|---|---|
| U3 draft lifecycle (warnings 6–7) | `f83c810` | Per-draft expiry scheduling, hourly retry sweep, bounded continuation, payload-free expiry audit, authoritative active-scope index and deterministic claim | Base `dc10d59`; head `f83c810`. Review/cherry-pick as the U3 lifecycle follow-up without rewriting `feat/melo-productization-u3`. |
| U5 asset cleanup (warning 8) | `0d09b68` | Independent cursor sweeps for trash/rollback/candidates, held-row progress, atomic per-row deletion workers, observable bounded retry/backoff | Base `f83c810`; head `0d09b68`. Keep as the U5 lifecycle follow-up after the U3 remediation on the integration stack; do not rewrite `feat/melo-productization-u5`. |
| U1 audit pagination/export (warning 9) | `f2cfad4` | Group snapshots at write time, group/current-branch legacy indexed sources, scoped cursors, relinking policy, removal of the 200-page client truncation | Base `0d09b68`; head `f2cfad4`. Keep as the U1 audit follow-up after the prior two serialized remediation commits; do not rewrite `feat/melo-productization-u1`. |

No branch was merged, rebased, force-pushed, or rewritten. No existing stacked branch history was modified.

## Acceptance evidence

### Warning 6 — operational bounded draft expiry

- `beginFormDraft` schedules the internal expiry worker at the retention deadline with `{}` only; no payload or user PII is placed in scheduler arguments.
- `crons.ts` runs an hourly bounded safety sweep so missed/failed scheduled runs are retried and visible through Convex scheduled-function operations after rollout.
- Each mutation processes at most 100 due rows and schedules immediate continuation on a full batch.
- Expiry is idempotent because processed rows clear `expiresAt`; payloads are erased and the audit summary says only that private content was omitted.
- Fake-time regression advances scheduling rather than directly invoking cleanup: 121 due rows drain over continuation, a newer row remains, and audit JSON contains none of the fixture payload content.

### Warning 7 — active draft hidden by tombstones

- Added authoritative `by_school_and_user_and_form_and_status` lookup and `by_activeScopeKey` deterministic claim index.
- Begin/recovery no longer inspect a newest-100 mixed-status window.
- Begin clears a single expired active row transactionally, refuses a live row, and fails closed on pre-existing multiple-active corruption.
- Closing or expiring a row clears its active claim.
- Regressions cover one active row behind 101 newer tombstones, `RECOVERY_REQUIRED`, concurrent begins with one success/one rejection, and exactly one active row.

### Warning 8 — non-starving asset cleanup

- Trash, rollback and PDF-candidate sources paginate independently and continue from source cursors based on exhaustion, not deletion count.
- Held and retry-delayed rows are skipped while the cursor advances, so later due rows remain reachable.
- Storage deletion/accounting/receipt work executes per row in an atomic mutation. An action catches a failed row transaction, records only generic `storage_delete_failed`, increments `cleanupFailureCount`, sets `cleanupRetryAt` with bounded exponential backoff, and schedules that source again.
- An hourly safety run retries missed work. Concurrent/replayed row workers revalidate due state and become no-ops after success.
- Regressions put four held rows ahead of an unheld row with `limit: 3`; the later row is purged while held records, blobs and charged bytes remain. An injected ownership/deletion failure creates no receipt and releases no accounting; after repair, retry creates one receipt and releases bytes once.

### Warning 9 — group audit scope and export

- Audit writes now snapshot the branch's current `groupId` when the caller does not supply an explicit historical group.
- Group-wide pagination uses `by_group_and_timestamp` for snapshots and `by_school_and_groupId_and_timestamp` for groupless legacy rows of currently linked branches. It does not query global `by_timestamp` for group scope.
- Visibility is index-scoped before pagination. Platform scope alone intentionally retains the global index.
- Snapshot events remain with their historical group after relinking. Because historical linkage cannot be inferred safely, groupless legacy rows explicitly follow the branch's current group until a reviewed backfill is authorized.
- CSV and printable-PDF preparation still consume the identical query projection. The client no longer aborts after 200 source pages; it retains the 5,000 matching-row limit and now detects non-advancing cursors.
- Regression places an old group event behind 205 one-item pages of unrelated global events and returns it directly from group scope. Relinking regression keeps old/new snapshots in their respective groups, attributes only the groupless legacy row to the current group, and leaks no unrelated tenant action.

## Files changed

- `packages/convex/crons.ts`
- `packages/convex/tsconfig.json`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/drafts.ts`
- `packages/convex/functions/academic/assets.ts`
- `packages/convex/functions/academic/audit.ts`
- `packages/convex/functions/academic/__tests__/drafts.integration.test.ts`
- `packages/convex/functions/academic/__tests__/assetWorkspace.integration.test.ts`
- `packages/convex/functions/academic/__tests__/auditExplorer.integration.test.ts`
- `packages/shared/src/audit-export.ts`
- `docs/tasks/orchestrator-sessions/orch-20260905-032529/ui-coverage-matrix.md`
- this result

## Final verification

- `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/drafts.integration.test.ts functions/academic/__tests__/assetWorkspace.integration.test.ts functions/academic/__tests__/commercialAndAssets.integration.test.ts functions/academic/__tests__/auditExplorer.integration.test.ts functions/academic/__tests__/rbacAudit.integration.test.ts` — **passed: 5 files / 50 tests**.
- `pnpm --filter @school/shared exec vitest run` — **passed: 23 files / 161 tests**.
- `pnpm --filter @school/convex typecheck` — **passed**.
- `pnpm --filter @school/shared typecheck` — **passed**.
- `pnpm --filter @school/convex exec eslint functions/academic/drafts.ts functions/academic/assets.ts functions/academic/audit.ts functions/academic/__tests__/drafts.integration.test.ts functions/academic/__tests__/assetWorkspace.integration.test.ts functions/academic/__tests__/auditExplorer.integration.test.ts crons.ts schema.ts` — **passed with no output**.
- `pnpm --filter @school/shared exec eslint src/audit-export.ts` — **passed with no output**.
- `git diff --check` — **passed** before each code commit; only Windows LF/CRLF notices were emitted.

The final Convex run emitted the existing Vite CJS deprecation notice and `TimeoutOverflowWarning` messages for synthetic 30/90-day schedules. Tests passed; these warnings are from long-delay timers in `convex-test`, not failed assertions.

Verification history was not papered over: the first draft regression queried cleared optional `expiresAt` values and was corrected to use the same positive due range as production; the first U5 typecheck exposed a union-ID narrowing error and was refactored into typed source branches; the first existing asset run exposed its stale `{ cleaned: 0 }` assertion after the scanner changed to queued work and was updated to assert the new scanner contract. A final Convex typecheck then caught an implicit test result type in the new audit loop; an explicit generated return type was added to the U1 commit and both typecheck and the audit test were rerun successfully.

## Self-review and remaining boundaries

- The three code slices are isolated in the requested U3/U5/U1 commits; documentation is separate.
- Scheduled draft arguments and cleanup failure state contain no form payload, filename, user email, or provider error text.
- Group cursors validate their source against the caller's current authorized group sources; membership/link changes require pagination restart rather than accepting a stale branch source.
- Storage accounting and purge receipts are changed only in the successful deletion mutation, not by the scanner or failure recorder.
- No upload, AV, private-delivery, entitlement, import, transfer identity, or broader packet scope was enabled.

Required follow-up before runtime acceptance:

1. Authorized development rollout of the new draft/audit indexes, optional claim/retry fields and cron registrations. No rollout was performed here.
2. Reviewed detection/remediation of any pre-existing multiple-active draft corruption and population of `activeScopeKey` for surviving active rows if needed.
3. Reviewed historical audit `groupId` backfill only where linkage-at-event-time evidence exists. Current linkage must not be projected backward across known relinks. No backfill or migration was written or run here.
4. Development-runtime observation of scheduled failure states/backoff and provider-specific deletion failures; local tests use synthetic storage and an injected ownership conflict.
5. Existing Critical 1, locally contained Critical 4, Warning 5, broader U1–U6 gaps and all U7/browser/provider/legal gates remain outside this task.
