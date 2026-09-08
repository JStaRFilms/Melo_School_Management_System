# Final independent code review

**Range:** `f6fc7c4..bef3cae` (`HEAD`)
**Scope:** release-blocking correctness, security/tenant isolation, financial integrity, history preservation, and truthfulness of external gates in the U1–U6 productization/follow-up work.
**Method:** static review of the changed contracts and full relevant files, plus focused local in-memory tests. No Convex CLI, deployment, migration, seed, server, login, provider, credential, production, or Astra operation was performed.

## Release blockers

### CRITICAL — Group-pool allocations are credited to every meter and survive pool expiry

**Locations:**
- `packages/convex/functions/academic/usageEntitlements.ts:40-50`
- `packages/convex/functions/academic/usageEntitlements.ts:135-142`
- `packages/convex/functions/academic/usageEntitlements.ts:156-157,170-171`
- `packages/convex/schema.ts:3678-3685`

`effectiveAllowance` loads every `usageBranchPoolAllocations` row for the cycle and sums all of them into `poolUnits`, without filtering by the requested `meterType`. The allocation row does not snapshot a meter type; that information exists only on the referenced `usageGroupPools` row. Therefore, for example, 40 allocated `ai_tokens` are also presented and enforced as 40 additional `ocr_pages` and 40 additional `storage_bytes`. Quote/confirm capacity checks consume this inflated result.

The creation mutation checks that the pool is current only at allocation time. `effectiveAllowance` never checks the referenced pool's `startAt`/`endAt`, so an allocation also remains available after its pool expires when the usage cycle is still active.

**Why this blocks release:** it breaks allowance-source separation and permits cross-meter/post-expiry quota use. The provider gate currently prevents an external charge, but enabling dispatch on top of this ledger would immediately create entitlement and commercial-integrity violations.

**Required next step:** persist immutable meter and effective-period provenance on each branch allocation, or boundedly resolve and validate every referenced pool before summing. Count only allocations whose pool matches the requested meter, branch/cycle/group/version, and current effective period. Add a multi-meter test and a post-pool-expiry test; the existing single-pool assertion does not exercise either failure.

### CRITICAL — A school cannot start a second usage cycle

**Locations:**
- `packages/convex/functions/academic/usageEntitlements.ts:72-87`
- `packages/convex/schema.ts:3673-3677,3710-3719`

The first cycle creates/replaces the school-and-meter singleton with a non-null `cycleId`. On every later non-overlapping cycle, line 83 rejects that existing meter merely because `existing[0].cycleId` is present. No closure/reconciliation path clears it, and `usageCycles.status` can only be the literal `active`.

**Why this blocks release:** cycle renewal/reset is a core allowance invariant. The implemented API works only for the first cycle in a school's lifetime, so term/annual rollover cannot be operated safely.

**Required next step:** make allocation state cycle-scoped and preserve prior-cycle rows, or implement an explicit reviewed close/reconcile transition that proves no live reservations before creating the next snapshot. Add an end-boundary rollover test that preserves prior usage history and activates a clean next cycle.

### CRITICAL — Invoice corrections are not idempotent for accepted keys, and `void` can leave a payable balance

**Location:** `packages/convex/functions/academic/commercial.ts:998-1058`

Two financial-integrity defects share this append-only correction seam:

1. The lookup uses raw `args.idempotencyKey` (`:1011-1018`), while insertion stores `args.idempotencyKey.trim()` (`:1051-1057`). A valid key with surrounding whitespace is not found on retry, so the same request can append the credit/debit again.
2. A `void` is required to equal `-invoice.totalMinor` (`:1028-1034`) rather than the negative of the current effective amount. After a prior debit, `void` leaves that debit payable but permanently prevents later corrections; after a prior credit, the negative-total guard can make voiding impossible.

**Why this blocks release:** retries can duplicate monetary adjustments, and a record labelled void does not reliably have a zero effective balance. Group totals then faithfully aggregate the wrong financial state.

**Required next step:** normalize the idempotency key once before both lookup and insertion. Compute the effective balance including prior monetary corrections before validating a void, then require a void to reduce that balance to exactly zero (or reject void whenever earlier monetary corrections exist). Add retries with whitespace-normalized keys and void-after-credit/debit cases.

### CRITICAL — Transfer numbering review is incomplete; explicit counter advancement is impossible

**Locations:**
- `packages/convex/functions/academic/transfers.ts:472-501,579-593,1280-1298`
- `apps/admin/app/academic/students/transfers/page.tsx:719-749`
- `packages/convex/functions/academic/admissionNumbers.ts:1015-1041,1085-1138`

The preview returns policy, format, counter key, and counter version, but destination acceptance accepts and forwards only `expectedPolicyVersion`. A format or counter-configuration change after confirmation therefore does not fail stale; the mutation can permanently allocate under configuration the operator did not review.

The UI also exposes “Explicit next counter,” but acceptance forwards no expected format/counter key/counter version. `commitManualAdmissionNumberHelper` requires all of those whenever `advanceTo` is supplied, so every transfer counter-advance attempt is rejected.

**Why this blocks release:** one governed numbering action is dead, while the automatic path does not preserve the full reviewed numbering intent. Admission numbers and their claims are permanent history.

**Required next step:** carry all preview versions through the public mutation, idempotency intent, and allocator/manual helper. If confirmation promises the displayed exact number rather than merely “whatever is next,” also carry and compare the proposed number/sequence atomically as the reviewed-import path does. Add stale-format, stale-counter, successful manual-advance, and replay tests.

### CRITICAL — Reviewed grade imports bypass assessment relationships and scoring policy

**Locations:**
- `packages/convex/functions/academic/migrationAutosave.ts:54-75,283-364`
- `packages/convex/functions/academic/migrationMerge.ts:530-572`
- Contrast: `packages/convex/functions/academic/assessmentRecords.ts:370-428,439-450`

The import validator checks only that student, class, subject, session, and term separately belong to the tenant. It does not establish that the student belongs to the selected class (or a reviewed historical enrollment context). Commit then bypasses the assessment derivation contract: each component may be as high as 100, totals may reach 300, grades/remarks are hard-coded, and every record claims a generic raw/100 exam snapshot. The normal assessment path validates class relationship, assessment mode, score ranges, grading bands, derived-subject restrictions, and editing state.

**Why this blocks release:** an explicitly “reviewed” import can silently create internally inconsistent marks and false grading-history snapshots that are later consumed by reports and the Portal. Same-tenant checks prevent a tenant leak but do not protect academic/history integrity.

**Required next step:** define an explicit reviewed import scoring-policy snapshot (including historical policy where applicable), validate the student/class enrollment relationship, and reuse the pure canonical score/grade derivation rules. Fail closed when historical relationship or policy evidence is unavailable. Add same-school mismatched-class, raw40/raw60, configured-band, aggregate-subject, and out-of-range total tests.

## Nonblockers / verified boundaries

- **External gates remain truthful and fail-closed.** `packages/convex/functions/foundation/paidUsageGate.ts:3-7` unconditionally rejects paid generation/OCR with no environment-key bypass. The real generation and OCR entry points call it before provider work (`documentGeneration.ts:1293-1296`, `lessonKnowledgeIngestion.ts:825-839`). The new confirmation workflow performs only local `reserved → dispatch_started → provider_unavailable → released` evidence and returns zero charged units (`usageEntitlements.ts:163-178`). Commercial purchase, recurring mandate, split, and merchant connection remain explicitly unavailable/unverified through `COMMERCIAL_GATES`.
- **Runtime acceptance is still honestly blocked, not passed.** `results/U7-preflight.md` records the absent approved-development-target allowlist, missing shell `CONVEX_DEPLOYMENT`, absent Apply runtime, and unsafe broad root Playwright setup. Those are external/release gates rather than code fixes. No runtime or provider claim should be promoted from E0.
- **Targeted tenant-boundary review found no demonstrated cross-tenant disclosure in the recent teacher selected-branch routes, commercial branch/group reads, reviewed-import workspace ownership, or transfer/Portal canonical-membership follow-up.** This does not override the runtime evidence gate.
- **Focused local tests passed but do not cover the blockers above:**
  - `pnpm --filter @school/convex exec vitest run functions/academic/__tests__/usageEntitlements.integration.test.ts functions/academic/__tests__/commercial.integration.test.ts functions/academic/__tests__/transfers.integration.test.ts functions/academic/__tests__/migrationReviewedImport.integration.test.ts`
  - Result: **39 passed / 4 files passed**.
- `git diff --check f6fc7c4..HEAD` did **not** pass because `docs/features/ProductWideModuleEntitlements.md:3` has pre-existing trailing whitespace in the reviewed range. This is documentation-only and not a release blocker under the requested risk scope.
- Existing unrelated working-tree state (`.gitignore`, other untracked session artifacts) was not reviewed or changed.

## Verdict

**NEEDS CHANGES**

Release is blocked by the five correctness/financial/history findings above, independently of the already-open E0/provider/deployment gates. The external integrations themselves remain safely disabled and no live/Astra operation was performed.
