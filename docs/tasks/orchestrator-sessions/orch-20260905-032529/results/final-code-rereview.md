# Final code re-review

**Reviewed range:** remediation commits `c48f19f..0ca9039`, with documentation head `6b5d3d9`, against blocker baseline `bef3cae`.

**Scope:** only the five blockers in `final-code-review.md`, semantic verification of their fixes, whether focused tests were weakened, and whether those exact changed domains introduced another release blocker. U7 environment acceptance remains separate and was not exercised.

**Safety boundary:** no live Convex, Astra, provider, deployment, migration, seed, server, production, credential, or external-system operation was performed.

## Per-blocker verdicts

### 1. Group-pool meter isolation and expiry — PARTIALLY RESOLVED; STILL BLOCKING

**Verified fix:** `packages/convex/functions/academic/usageEntitlements.ts:40-66` now resolves each allocation's pool, filters by requested meter and entitlement version, enforces its effective period, and requires a current active group/link. This closes the original cross-meter quota inflation and live post-expiry availability. The focused test now checks another meter, archived-group provenance, and expiry.

**Residual/new release blocker:** cycle closure snapshots stale denormalized allowance totals. Pool/top-up creation patches `usageMeterAllocations.allocatedUnits` and source totals, but expiry only affects the dynamic calculation at `:40-66`; no expiry path reduces the meter row. `closeUsageCycle` then reviews and permanently copies the stale meter fields at `:117-142`, rather than recomputing effective allowance at the close boundary. A pool that expired before cycle end can therefore be correctly unavailable for dispatch but still be recorded in the immutable closing `poolUnits`/`allocatedUnits` history. Expiring top-ups/exceptions have the same problem.

**Required fix:** define closing-snapshot semantics explicitly and derive the immutable closing source totals from effective, provenance-validated grants/pools at the cycle boundary (or separately snapshot cumulative-granted and effective-at-close values). Add close-after-expired-pool and close-after-expired-grant tests.

### 2. Repeatable usage cycles — RESOLVED

**Verified fix:** `usageEntitlements.ts:88-112` requires prior cycles to be closed and accepts a prior meter only when its cycle is closed and has a per-meter snapshot. `closeUsageCycle` at `:114-148` requires Platform authority, end-boundary timing, one reviewed entry per cycle meter, exact stored balances, and zero reservations before atomically snapshotting and closing. The next cycle resets the singleton meter while preserving prior snapshots.

The rollover regression rejects a live reservation, closes at the exact boundary, verifies three immutable snapshots, and starts a clean second cycle. The original “second cycle always fails” defect is closed. The closing-history defect under blocker 1 must still be fixed before these snapshots are release-safe.

### 3. Invoice correction idempotency and void semantics — RESOLVED

**Verified fix:** `packages/convex/functions/academic/commercial.ts:1008-1058` computes one trimmed idempotency key for both lookup and insertion. It computes the current effective invoice amount from the original plus all prior corrections, requires a void to negate that amount exactly, rejects a negative resulting balance, and still prevents post-void corrections.

The added tests verify whitespace-normalized replay creates one row and verify both credit-before-void and debit-before-void produce a zero balance. Existing authorization, aggregation, and correction retry assertions remain intact.

### 4. Transfer numbering intent and manual advancement — PARTIALLY RESOLVED; STILL BLOCKING

**Verified fix:** `packages/convex/functions/academic/transfers.ts:472-511,602-626` and the Admin caller now carry policy/format/counter versions plus exact proposed number and sequence in the acceptance intent. Automatic allocation uses the destination class level and transactionally rejects stale configuration or a changed exact proposal. Replay and stale-format/counter tests are stronger than before.

**Residual release blocker:** the manual advancement call at `transfers.ts:589-599` still does not pass `level: destClass.level` (or an explicit `sequenceKey`) to `commitManualAdmissionNumberHelper`. Counter selection is level-sensitive in `admissionNumbers.ts:185-238`; the helper reselects its context from its arguments at `admissionNumbers.ts:1119-1133`. For a branch using a level-specific admission sequence, preview selects that level counter, but manual acceptance reselects the default/legacy counter and rejects the reviewed counter key—or could target the wrong context if keys happen to align. The new success test uses only the legacy default counter and therefore misses this production configuration.

**Required fix:** pass `level: destClass.level` to the manual helper (or carry and validate an intentionally selected sequence key) and add a successful level-specific manual-advance test that proves only the reviewed counter moves.

### 5. Reviewed grade-import relationships and scoring policy — PARTIALLY RESOLVED; STILL BLOCKING

**Verified fix:** review and commit now validate same-school relationship evidence, reject aggregate subjects, use shared canonical score validation/derivation, snapshot the reviewed assessment/grading configuration, and reject policy drift before commit. The added raw40/raw60, custom-band, mismatch, aggregate, invalid-score, drift, and unavailable inactive-session tests materially strengthen coverage. The former hard-coded raw/100 and A/C/F derivation is gone.

**Residual release blocker:** historical-policy fail-closed logic is based only on `session.isActive` (`packages/convex/functions/academic/migrationAutosave.ts:102-130`). The selected term is later checked only for tenant/session ownership at `:440-460`; its active/archive state and any immutable term policy are ignored. Consequently, an inactive or archived prior term inside the currently active session is accepted and stamped with today's mutable school/group grading policy, despite the remediation contract saying historical rows without immutable scoring-policy evidence fail closed. This can create false historical grade snapshots if policy changed between terms.

**Required fix:** treat an inactive/archived selected term as historical and require an immutable term policy source, or fail closed. Add an inactive-term-within-active-session regression, including policy changes between terms.

## Test-integrity review

No focused test file was removed. Across the four suites, remediation adds 484 lines and removes 19, and the original behavioral coverage remains. Transfer tests were updated to supply the now-required reviewed proposal; the manual case is stronger for default counters but lacks a level-specific counter. The prior grade smoke assertion changed its raw exam input from 50 to the valid raw40 maximum and now asserts derived values and policy snapshots, so that change is not a weakening.

The passing tests do not cover the three residual cases above: closing after expiring allowance sources, level-specific manual transfer advancement, and an inactive term within an active session.

## Checks run

- Focused Convex integration suite: **50 passed / 4 files passed**
  - `usageEntitlements.integration.test.ts`: 6
  - `commercial.integration.test.ts`: 9
  - `transfers.integration.test.ts`: 17
  - `migrationReviewedImport.integration.test.ts`: 18
- `pnpm --filter @school/convex typecheck`: **passed**
- `pnpm --filter @school/admin typecheck`: **passed**
- `git diff --check bef3cae..6b5d3d9`: **passed**

Paid/provider gate files were unchanged in the remediation range. U7 target/environment gates were not re-evaluated and remain a separate acceptance decision.

## Final code-review verdict

Two blockers are fully resolved; blockers 1, 4, and 5 are only partially resolved and retain release-significant history/numbering-policy cases not covered by the new tests.

**NEEDS CHANGES**
