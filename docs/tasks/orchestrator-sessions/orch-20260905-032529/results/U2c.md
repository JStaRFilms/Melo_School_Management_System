# U2c — Numbering and enrollment

**Status: PARTIAL, locally verified / E0. Not the complete packet definition of done.** Actual settings and enrollment integration are delivered. Named branch/level counters, explicitly permitted group-wide counters and the U1f admission-template default/override resolver are NOT implemented. These are remaining code scope, not browser evidence or external-access blockers. No live Convex/CLI/codegen/deployment, migration, provider, production operation or commit was performed.

## Implemented contract

- Actual `/admin/settings/admission-numbering` has a constrained-token input/builder, illustrative live preview, explicit school/branch codes, next-sequence confirmation, continuous/session/calendar options, loaded version, missing-session/unconfigured/denied/error states, retained failed edits and discard/latest. `/academic/students/onboarding` links to it and displays the selected class-level preview and reviewed policy version. No made-up campus/JSS1/calendar-year defaults are installed.
- `getAdmissionNumberPolicy({schoolId,level?})` requires `enrollment.intakes.manage`; returns `{policy,version,nextSequence,sessionYear,preview}`. The old unguarded, synthetic-policy response was replaced. One active nonarchived academic session is required; YEAR always uses its UTC start year, including calendar-reset policies.
- `updateAdmissionNumberPolicy({schoolId,pattern,schoolCode,campusCode,resetFrequency?,currentSequence?,expectedVersion,confirmedNextSequence})` validates exact version, one SEQ token with padding 1–9, allowed tokens/separators, integer counter 1–999999999 and bounded explicit codes. Never lowers the effective next counter. Policy updates are prospective and audit permanently with leadership warning. Existing policy rows gain optional `version/resetPeriod`; legacy missing reset markers preserve their current counter instead of inventing a rewind.
- Default implementation is **one independent counter per school/branch**; LEVEL is a formatting token supplied by the selected class's `level`, not a separate counter. Session reset uses session identity; calendar reset uses UTC calendar year; continuous never resets. A repeated formatted identifier causes an explicit conflict, never an automatic skip or guessed advancement.
- `createStudent` calls allocation inside the actual creation mutation, after input/class validation. Successful parent-link operations are in the same mutation. Client opening/preview/photo work never allocates. Optional `requestKey` stores only school/operator/key/student ID in `enrollmentRequests`; replay by the same operator returns the original student, including after a lost response. It is an intent identity, not permission to create another student after editing the form. The onboarding page retains it across follow-up failures and clears it on a successful reset.
- Nonempty `admissionNumber` is preserved (existing trimming convention), requires separate `enrollment.admissions.override_number`, `overrideConfirmed`, an 8–240-character `overrideReason`, and optional explicit `advanceCounterTo`. Blank means genuinely missing and triggers allocation. No manual string is parsed for counter advancement. The UI clearly distinguishes unavailable override authority and the unchanged-counter choice.
- Explicit `updateStudent` identifier corrections now require that same override contract. The old identifier receives a retained claim before correction. Ordinary unchanged identifier edits are unaffected. Existing correction forms that actually rename identifiers need these newly required confirmation/reason fields; they cannot silently bypass authority.
- Additive `admissionNumberClaims` prevents reuse even if an assigned student is later removed. Existing students, including archived ones, are checked by the existing school/admission-number index. No old identifiers, imports or users were renamed/backfilled.

## U4b / U6 handoff

All helpers are in `academic/admissionNumbers.ts`:

1. `proposeAdmissionNumberHelper(ctx,{schoolId,level?})`: **read-only**, caller must authorize its import/transfer audience first. Returns allocatedNumber/sequenceNumber/policyVersion/period/policyId. Proposal is not a reservation. Use only for missing imported values; supplied identifiers remain untouched.
2. `allocateNextAdmissionNumberHelper(ctx,{schoolId,level?,expectedVersion?})`: recomputes, checks the reviewed version if supplied, claims uniqueness and advances atomically. Call ONLY inside the final successful enrollment/import/destination mutation. Legacy year/campus/school token override arguments now reject rather than override reviewed policy/session. No gapless promise.
3. `commitManualAdmissionNumberHelper(ctx,{schoolId,number,reason?,confirmed?,advanceTo?})`: separately authorizes, claims the supplied identifier and optionally advances to the exact explicit value. No policy required when preserving a supplied number without advancement.
4. Existing internal allocator remains internal for compatibility, not a client preallocation API. U4b still owns reviewed batch/idempotency contracts and missing-only adoption. U6 automatic destination acceptance already uses the helper and now requires explicit destination policy/session configuration; the transfer test fixture was updated accordingly. U6 manual-transfer path still needs adoption of the permanent-claim helper and explicit advancement controls in its own transaction/UI.

## Verification and self-review

- New numbering suite: **8 PASS**. Tests actual create/replay/concurrent creates, manual preservation/reason/explicit advancement, separate override denial, unauthorized policy read, nonmutating previews, concurrent helper transactions, rollback, claims/no reuse, format bounds, version conflicts/no rewind, session start year and calendar/session resets.
- Transfer suite: **7 PASS**. Added explicit synthetic destination configuration. One unauthenticated school-list assertion was aligned with U1a's structured `UNAUTHENTICATED` error; denial was not removed or weakened into success.
- Combined final backend bundle (numbering, banks, billing, transfers, foundation): **5 files / 25 PASS**.
- Admin settings DOM bundle: **3 PASS** (numbering reviewed version/confirmation, retained save failure; shared denied settings and bank confirmation tests). Shared invoice renderer: **2 PASS**.
- Convex/Admin/Portal/Shared typechecks passed. Focused lint and final diff checks are recorded in U2d/final handoff.
- Cold import of the existing studentEnrollment/provisioning graph initially exceeded the test's five-second budget; loading that module at test collection resolved it. No timeout increase or provider invocation.

Self-review removed redundant enrollment payload retention, kept replay metadata private/minimal, used actual class level instead of class display name, protected legacy identifiers during explicit correction, and kept reset collisions terminal. No automatic policy initialization, guessed import reconciliation, sequence recycling or generated API edits.

## Remaining acceptance work (not U7-only)

- Named branch/campus and level counters, group-wide permissioned counters, effective group admission template inheritance/version references are still missing.
- U4b reviewed-import caller adoption and U6 manual-transfer helper adoption remain their assigned follow-on work.
- The complete student-profile correction UI is not adapted to the newly enforced override reason/confirmation. Existing unchanged student editing works; renaming will fail closed until adopted.
- U3a/U3b own shared draft/router/branch/account departure protection; no separate persistence framework was added.
- E0: U7 must still capture actual desktop/320px/keyboard states, stale policy/counter preview, authorization revocation, enrollment retries and save errors on an authorized synthetic target. Schema/functions are authored only, not deployed.

## Files

Modified `academic/admissionNumbers.ts`, `studentEnrollment.ts`, additive schema, onboarding page/form and transfer fixture. Created numbering settings page/error and numbering integration test; shared Admin settings DOM suite is listed in U2d. No generated file was hand-edited.
