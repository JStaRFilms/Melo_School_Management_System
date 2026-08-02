# FU3 Batch 1 integration report

## Integration

- Session: `orch-20260722-114501`
- Feature branch: `feature/admissions-draft-reliability`
- Feature baseline: `c9b5f34`
- Feature commits: `43490ae`, `2d760d1`, `955c2b9`, `1db6893`
- Integration merge: `f75fc40`
- Target: `integration/obhis-admissions-release`
- `master`: untouched

## Root cause and implementation

Development evidence showed one draft at version 6 with no profile/contact rows and five successful saves of the same `preferred-name` answer. Dynamic-field blur and **Save and continue** could submit independent mutations with the same `expectedVersion`; the answer write incremented the version and the core/contact write then failed safely as stale.

Batch 1 now:

- treats exact core, contact, and answer replays as no-ops after authoritative version, ownership, editability, and validation checks;
- serializes application writes and advances only from acknowledged application versions;
- suppresses unchanged writes;
- applies a 700ms per-edit debounce and independent 7-second maximum attempt interval while dirty data remains;
- stores only editable draft values and reconciliation metadata in an application-scoped local recovery record;
- retries transient/offline failures with bounded backoff and does not loop deterministic validation failures;
- pauses on optimistic conflict, requires explicit review/retry, and restores the latest server baseline when recovery is discarded;
- shows saving, saved, offline/pending, retrying, and conflict states;
- validates the active section, names/focuses invalid fields, saves, and advances only after success;
- keeps errors scoped to the active section.

Guardian ownership, tenant isolation, submitted snapshot immutability, changes-requested locks, and stale-writer rejection remain server-enforced. No schema/data migration is required.

## Integration-owner review

The first FU2 implementation was returned twice to the same coder conversation. Corrections addressed:

1. document version accidentally replacing the application draft version in the queue;
2. a ceiling timer that could be postponed by rerenders;
3. generic configured-field failures instead of named errors;
4. recovered conflicts that could resume before a separate deliberate retry;
5. loss of per-edit debounce after stabilizing the ceiling;
6. visible conditional-field progression requirements;
7. discard behavior that left local values capable of reappearing in a later whole-section save;
8. field focus for deterministic server answer errors.

## Automated verification

Passed on the integrated branch:

- `pnpm --filter @school/apply test -- draftAutosave.test.ts` — 2 files, 18 tests
- `pnpm --filter @school/apply typecheck`
- `pnpm --filter @school/apply exec eslint components/GuardianSurface.tsx lib/draftAutosave.ts tests/draftAutosave.test.ts`
- `pnpm --filter @school/apply build`
- `pnpm --filter @school/convex exec vitest run admissionsDomain.test.ts` — 1 file, 29 tests
- `pnpm --filter @school/convex typecheck`
- `git diff --check origin/integration/obhis-admissions-release..HEAD` after task-packet whitespace normalization

A prior broad Convex package-script invocation ran beyond the focused scope and hit four unrelated existing 5-second test timeouts. The focused admissions suite passes and no unrelated test was changed.

## Session-artifact transit audit

Takomi board updates moved FU packets between status folders and regenerated `Orchestrator_Summary.md`.

- FU1, FU2, and FU3 packet bodies were compared against planning commit `c9b5f34` and were content-identical after every status move.
- Only the two Markdown hard-break spaces on each packet's Session line were later normalized so repository `diff --check` passes; no wording or task information changed.
- Hand-authored baseline/continuity sections removed by summary regeneration were restored after the final board update.

## User-owned manual verification

No assistant-controlled browser automation was run. In the configured development environment, manually verify:

1. Enter valid Child and Form values, pause, confirm `Saving…` then `Saved just now`, and refresh to confirm persistence.
2. Edit while offline, confirm `Offline — changes waiting to sync`, reconnect, and confirm successful sync.
3. Close/restart with pending edits, restore them, review, and sync.
4. Keep typing for longer than seven seconds and confirm saving is still attempted without interrupting input.
5. Use **Save and continue** from Child, Guardian Contact, and a configured section; confirm one advance only after success.
6. Enter invalid required/configured values; confirm named inline errors and focus on the first invalid field.
7. Navigate between sections; confirm stale Child errors are not shown as the active Guardian/Documents error.
8. Create a second-tab edit conflict; confirm no silent overwrite, explicit retry/discard choices, and latest server values after discard.
9. Upload a document and then save another section; confirm document version does not corrupt application draft concurrency.
10. Complete review/submission and confirm the submitted snapshot remains locked and Admin sees the expected immutable values.

## Browser follow-up findings

The guardian-owned FU3 browser pass confirmed online autosave/manual save, refresh persistence, document upload, and successful submission. It also found three gaps that were not visible in automated checks:

- Offline mutations could remain pending inside the Convex client, leaving the UI on `Saving…` before a rejected promise reached the existing offline branch. Commit `8b25b54` now reacts to browser connectivity immediately, keeps recovery local while offline, flushes on reconnect through the serialized queue, and preserves only a previously ready guardian identity during an explicit offline interval.
- A submitted application remained on the disabled multi-step review form with withdrawal as the apparent next action. Commit `7ba9edc` now renders a read-only status destination, makes return to the application workspace primary, preserves guardian-visible school messages, and subordinates withdrawal as an exceptional action.
- The attempted Admin command launched `@school/apply` a second time. Commit `8788b11` allows the current Tailscale host for Admin development; the correct package is `@school/admin` on port 3002.

Post-follow-up automated checks pass: 20 focused Apply tests, Apply typecheck, Admin typecheck, targeted Apply ESLint, and `git diff --check`. Admin startup returned HTTP 200 from both `http://localhost:3002` and `http://100.84.230.66:3002` during a bounded verification run.

Manual status remains explicit: the new offline indicator/reconnect behavior still needs a browser retest; the user observed independent tab state and eventual last acknowledged/manual-save dominance but did not exercise the explicit conflict resolution screen; and secure checkout over Tailscale remains unresolved. These items must not be reported as browser-passed.

## Deferred work and release constraints

Batch 2 legal-name migration and Batch 3 same-origin document viewing/removal remain pending. OBHIS public publication remains blocked on approved identity, content, assets, and rights evidence. No production data or deployment setting was changed, and no Paystack secret was displayed.
