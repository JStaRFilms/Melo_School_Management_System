# U3b — People forms persistent recovery

**Status: local code scope complete; authenticated browser/runtime evidence remains E0.** No live Convex/CLI, deployment, migration, provider, credential, production-data or Astra operation was performed. The unrelated `.gitignore` edit and untracked orchestration artifacts were preserved and excluded from this U3-only follow-up.

## Actual adapters and field classification

| Draft key / actual owner | Persisted private server projection | Deliberately excluded |
|---|---|---|
| `student_onboarding` — `/academic/students/onboarding/page.tsx` → `StudentFirstOnboardingForm` | Student names, admission number, reviewed U2 numbering pins/override reason/confirmation/explicit advancement, gender, class, house, DOB, guardian name/phone/address; parent names/email/phone/relationship/primary-contact intent; portal-provisioning intent booleans; actor-scoped enrollment request key | Student/parent temporary passwords, returned credential summary, raw photo `File`, preview URL, upload/storage ID, filename/content type, provider responses/tokens |
| `family_onboarding` — `/academic/students/page.tsx` state owner → `FamilyOnboardingForm` | Student names/admission number/gender/class, optional house/DOB/guardian contact/address, parent names/email/phone/relationship/primary-contact intent, actor-scoped enrollment request key | Raw photo/file, preview URL and all upload metadata; no credential fields exist in this form |
| `staff_onboarding` — `/academic/teachers` → one responsive `TeacherCreationForm` writer | Teacher display name and email only | Temporary password, returned teacher/credential result, copied/error/pending UI state, auth/provider IDs/tokens |

All three use the existing strict shared registry and creator/branch/capability-checked Convex lifecycle. The thin Admin adapter explicitly allocates one immutable draft ID, retains it for revision-pinned saves and closure, never allocates from delayed stale saves, and resets only after a confirmed close. The previous duplicate desktop/mobile teacher creation mounts were collapsed to one responsive writer.

## Recovery, saving and progress

- Approved edits start one authenticated server instance. Autosave remains the shared 1.5-second debounce (bounded 1–2 seconds), with an explicit **Save draft** control and only server-confirmed timestamps/status.
- Existing server content opens the timestamped Preview/Resume/Discard modal and never overwrites current edits. Conflict status pauses writes; **Preview latest draft** loads the reactive server revision only after explicit Resume. Discard is awaited.
- Same-document reauthentication still has the U3a account/context-keyed RAM projection; no local/session/IndexedDB persistence was added. Account/branch mismatches cannot save or resume another scope.
- Recovery notices explicitly require photo reselection and temporary-password re-entry. Preview/audit payloads contain no passwords, credential summaries, photos, raw documents or upload references. Draft lifecycle audit remains payload-free.
- Student onboarding now uses required-valid section progress, including current U2 numbering review and invalid DOB/partial-family/portal states. Family onboarding uses required-valid student progress and separately exposes optional family errors. The old position-based/minimum-10% visual was removed. Family grids reflow to one column at 320px. The short three-field staff form intentionally has no duplicate progress stepper.

## Submit/retry contract

### Student and family enrollment

The generated enrollment request key is part of the approved operational draft projection and is flushed before any domain submit. `createStudent` already stores that key transactionally with the created student and returns the original student ID for an authenticated same-operator/same-school replay.

- Standalone onboarding retains the acknowledged student ID in memory for immediate follow-up retries. After reload/recovery, replaying the persisted request key re-derives that same protected ID server-side instead of trusting a client-supplied student ID.
- Family linking and portal credential calls are upserts. A family-list create carries the same request key; an uncertain successful response replays the original student rather than inserting another.
- The draft is tombstoned only after every requested follow-up has succeeded. If a later action or tombstone acknowledgement fails, the form and key remain, `submissionFailed()` unfreezes the controller, and retry cannot duplicate enrollment.
- Numbering authority is unchanged: automatic/manual allocation remains inside U2c's successful student transaction with its policy/format/counter pins. This U3 follow-up adds no reservation, gapless promise or authority bypass. The separate family-list numbering-control gap remains U2-owned and is not disguised as draft work.

### Staff onboarding

The optional draft ID/revision is passed through the existing teacher action only after the approved name/email projection is saved. The local teacher-record mutation calls `finishFormDraft(..., "committed")` in the same transaction as inserting the teacher row. Provider credentials never enter that transaction or draft. A failed transaction leaves both local row and draft closure unapplied; a successful local insert cannot leave an active draft through an early optimistic clear.

## Tests and self-review

Final commands:

- `pnpm --filter @school/admin test` — **27 files / 120 tests PASS**.
- Focused Admin U3 bundle (`draft-core`, `people-draft-adapters`, `student-onboarding-retry`, `form-adoption-guards`) — **4 files / 25 tests PASS**.
- `pnpm --filter @school/shared test` — **23 files / 163 tests PASS**; focused draft/progress subset **2 files / 14 tests PASS**.
- Convex drafts + U2 numbering — **2 files / 22 tests PASS** (11 each). The synthetic long-retention timers emit the existing `TimeoutOverflowWarning`; assertions pass.
- Admin, Shared, Convex and Teacher `typecheck` — **PASS**.
- Explicit changed-file ESLint — **0 errors / 5 pre-existing warnings** (unused imports/constant/router and existing `<img>` warning).
- `node scripts/audit-theme-colors.mjs` — **informational PASS**. Direct colors in touched forms classify as existing semantic status colors, product neutrals or existing product accents; no tenant branding replacement was made.
- `git diff --check` — **PASS**, with repository CRLF advisories only.

Coverage demonstrates strict sensitive-field rejection, one-instance allocation, exact revision save/closure, timestamped non-silent recovery, explicit resume, fresh-instance reset after closure, creator/branch server isolation, concurrent conflict/no stale resurrection, staff atomic tombstone, same-student retry, pending/failure departure behavior and invalid optional progress. The first combined Convex run exceeded the default 5-second limit while the new transaction case ran in parallel; its explicit 10-second test allowance was added and the same two-file command passed in 4.1 seconds for that suite. No assertion was weakened to hide a product failure.

## Files changed

- Shared: `packages/shared/src/drafts/{registry.ts,useFormDraft.ts,DraftRecoveryModal.tsx}`
- Admin adapter/UI: `apps/admin/lib/usePersistentFormDraft.ts`, `apps/admin/lib/components/drafts/PersistentFormDraftControls.tsx`
- Actual owners/forms: standalone student onboarding page/form, students page/family form, teachers page/creation form
- Convex: `packages/convex/functions/academic/academicSetup.ts`
- Tests: Admin draft/adoption/retry plus new `people-draft-adapters.test.tsx`; Convex draft integration
- Documentation: this result and `ui-coverage-matrix.md`

## Remaining U7 evidence / real limitations

Authenticated desktop and 320px browser proof remains E0: native reload warning, Back/Forward sentinel behavior, sidebar/account transition, same-account reauthentication return, reactive two-tab conflict, keyboard/focus and actual branch isolation require the separately authorized U7 environment. No screenshots are claimed. Arbitrary unguarded raw Next router/history calls remain outside U3a's supported interception contract. No live rollout of already-authored draft indexes/functions was performed here.

The existing teacher action still calls the external auth provider before its local Convex teacher-record transaction. The new local row/draft closure is atomic, but a provider success followed by any local transaction failure remains the pre-existing provider-reconciliation risk; solving that requires the explicitly excluded auth-provider/idempotency redesign and is not hidden as completed here.
