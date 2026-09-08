# U3a — Private draft and departure core

**Status: core implemented and locally verified; form adoption remains U3b/U3c/U4b, browser acceptance E0.** No commits, live Convex/CLI, deployment, migrations, production, credentials, provider calls, servers or cleanup jobs were run. Existing unrelated work was preserved. Additive schema is authored, not deployed. Generated files were not edited.

## Implemented contract

### Server instances, authority and retention

`packages/convex/functions/academic/drafts.ts` deliberately replaces the unused arbitrary-payload/default-school upsert contract:

1. `getFormDraft({schoolId, formKey, entityId?})` requires current authenticated membership, creator authority and explicit school. Unauthorized/suspended/revoked reads throw instead of masquerading as an empty draft. It returns only this creator's active, compatible, unexpired draft. An undefined client query result is loading, not permission to autosave.
2. `beginFormDraft({schoolId, formKey, schemaVersion:1})` explicitly allocates a server instance at revision 0. Existing active recovery must be resolved first. **Only this operation allocates an ID.** Two simultaneous tabs cannot both allocate an active draft for the same creator/form.
3. `saveFormDraft({schoolId, draftId, schemaVersion, expectedRevision, payload})` requires an existing active instance and an exact integer revision. It returns `{draftId, revision, lastSavedAt}` only after the transaction commits. No omitted-revision last-writer-wins path remains. Convex structured error codes include `CONFLICT`, `CLOSED`, `EXPIRED`, `SCHEMA_REJECTED`, `RECOVERY_REQUIRED`, `FORBIDDEN`.
4. `discardFormDraft({schoolId,draftId,expectedRevision})` closes the exact instance and erases its payload. `finishFormDraft(ctx,args,"committed")` is the helper for **the same successful domain submission transaction**. A public `commitFormDraft` closure endpoint remains for legacy non-atomic adapters, but new adoption must use the transactional helper. Closing a private draft does not create any student/invoice/domain record.
5. Delayed autosaves reference an immutable server ID; a discarded/submitted ID cannot resurrect. Starting fresh requires an explicit new allocation. Payloads are erased immediately on discard/commit; tombstones retain no editable content. Lifecycle audit records create/discard/commit/expiry with content omitted, not every autosave. Audit visibility never grants access to draft content.
6. `schemaVersion` and `expiresAt` are additive optional schema fields for old-row compatibility; new instances always set them. Retention is fixed from creation, 30 days ordinary / 90 days admissions, import and teacher planning. Reads/resume/writes enforce expiry; a draft cannot renew itself indefinitely by autosaving. Internal `expireFormDrafts({})` has a bounded 100-row indexed payload-erasure contract, keeps tombstones, and attributes expiry to system. **No scheduler/cron is installed or executed.** Legacy unversioned/unclassified rows are not offered for recovery; no automatic migration or deletion of those rows was performed.

### Privacy/schema registration

`@school/shared/drafts` exports `draftRegistry`, `DraftFormKey`, `DraftPayload<K>`, `parseDraftPayload(key,unknown)`. Shared Zod schemas and server validation use the same source file, without importing the React barrel into Convex.

Registered v1 projections:

| Key | Allowed projection | Classification / retention | Authority |
|---|---|---|---|
| student_onboarding | optional first/last/middle name, email, phone, class-level text | personal / 90 days | admin + enrollment.intakes.manage |
| family_onboarding | bounded arrays of those guardian/student projections | personal / 90 days | admin + enrollment.intakes.manage |
| staff_onboarding | person projection and optional display name | personal / 30 days | admin + staff.onboard |
| fee_plan_builder | plan name, finite nonnegative amount/discount, description | operational / 30 days | admin + finance.fee_plans.manage |
| academic_setup | name/start-date/end-date text | operational / 30 days | admin + academic.classes.manage |
| report_card_configuration | name/description | operational / 30 days | admin + academic.grading_bands.manage |
| curriculum_plan | week/topic/objectives/activities | operational / 90 days | teacher private new plan; admin requires academic.curriculum.manage |
| import_review | bounded column/target mappings, **not source rows/documents** | operational / 90 days | admin + system.migration.execute |

All schemas are strict allowlists with string/array/total-size bounds. They are intentionally **projections**, not a whole-form persistence dump. All are create-only: arbitrary entity IDs are rejected until a domain-specific ownership/assignment resolver is added. A draft does not authorize final submission or bypass teacher assignment checks. Guard-only short settings need no persistent registration.

Local recovery is disabled for every registration. No localStorage/sessionStorage/IndexedDB writes were added. Passwords, tokens, payment secrets, bank-account details, health/safeguarding records, raw files, upload IDs and URLs are not accepted fields. **Temporary uploads are unsupported and rejected**, rather than falsely claiming ownership/AV/scanner guarantees. U4b/U5c must use a separately authorized private upload lifecycle with ownership, MIME/size, expiry and real scanner controls before adding any reference field. Never replace a scanner gate with an unchecked storage ID or public URL.

### Form hook/adapter contract

`useFormDraft<T>` requires:
- stable `formKey`, `contextKey` (school + entity/new-record context), original authenticated `accountId`;
- immutable/stable `currentData` state or memoized approved projection, `isDirty`, and `parsePayload` using the registered schema;
- real `{connected, authenticated, accountId}` connection state;
- `serverDraft` (undefined/loading, null/absent, or the query result);
- `onSave(payload, expectedRevision)` returning server-confirmed revision/time;
- `onRestore` and an awaited `onDiscardServerDraft(expectedRevision)`.

The form adapter owns its allocated `draftId`: allocate explicitly once, retain that exact ID, and send it on every save/closure. **Never implement onSave as a new allocation on every call or on CLOSED/EXPIRED.** After discard/start-fresh, explicitly allocate and remount a new hook instance; do not reuse the closed controller. Likewise key/remount the editor on a validated account/branch/entity context change. `onSave` must not substitute Date.now(), resolve void, swallow errors, or reset business-form state.

The hook supplies 1.5-second debounce (clamped 1–2 seconds), awaited explicit `retrySave()`, server-confirmed status/time, serialized writes, reactive-echo suppression and follow-up saving for edits made during a request. Failed awaited saves reject, leave edits intact and do not authorize departure. Conflict pauses autosave; `previewLatest()` opens recovery, `handleResumeDraft()` explicitly replaces form data using the latest revision, or dismiss to keep current edits. Do not force-update revision behind the user's back.

Recovery is offered even when the current form is dirty, never silently restored. Show `DraftRecoveryModal` with the returned draft, Resume/Preview/Discard and `onStay={dismissRecoveryModal}`. Conflict comparison uses the preview plus the still-open current form. Expired/closed instances cannot be retried into new ones.

For submission: `await prepareSubmission()` flushes and freezes autosave and returns the revision; submit through a domain mutation that calls `finishFormDraft` in that same transaction; call `submissionSucceeded()` only after success, otherwise `submissionFailed()`. Wire guard discard to `handleDiscardDraft`, then reset/remount the form only after confirmed closure. No domain submit mutation was silently rewritten in U3a.

### Actual connection/auth resilience

Admin and Teacher `lib/useDraftConnection.ts` read `useConvexConnectionState().isWebSocketConnected` and `useConvexAuth()`, plus the app's authenticated account ID. They must run beneath a configured Convex provider. Browser `navigator.onLine` is **not** server connectivity evidence. The shared hook does not assume internet-online events mean authenticated server access.

Disconnect/reauth pauses autosave; reconnect requires an explicit retry/latest-preview decision. Changed account/context cannot save or resume the previous account's data. A late acknowledgement during disconnect is not labelled currently saved/connected.

`DepartureGuardProvider` includes an account/context-keyed **RAM-only** `DraftMemoryProvider`, above auth-gated route children. Only parsed projections are cached. Thus a same-document auth-gate unmount can offer `memoryDraft` on return to the same account, with `resumeMemoryDraft()` / `discardMemoryDraft()`; another account does not receive that recovery offer. Memory Resume is an explicit unsaved recovery, not server confirmation; the captured revision still conflicts against concurrent edits. Cache candidates age out after 30 minutes (minute pruning); acknowledged unchanged data and successful closure clear the buffer. No promise survives a hard reload, full-document reauthentication, tab closure or browser crash. Invalid/unapproved form fields are not copied into this cache.

### U1b guard handshake and supported departures

Admin/Teacher root layouts now mount `DepartureGuardProvider` above their routes; both `StaffWorkspace` components pass `useDepartureGuard().requestDeparture` to the existing U1b navbar seam. Navbar implementation/branch eligibility were not rewritten. Existing shell admission tests still pass. **Operational branch switching remains disabled for U1b's unscoped routes.**

Every adopted form calls `useDirtyForm({name,isDirty,save?,discard})`. `requestDeparture` accepts U1b link/router/workspace/branch/account/sign_out plus close/back intents. For imperative push/replace, modal close, workspace or account actions: await approval before performing the action. Guard-only forms omit save; persistent forms await save or tombstone closure. Multiple pending departure prompts are suppressed.

Implemented browser paths:
- document-capture ordinary HTTP(S) links, including sidebar/content links outside the navbar; modifier/new-window/download actions are left alone because they do not replace the current document;
- actual U1b navbar sign-out buttons through the awaited callback;
- native beforeunload close/reload warning (browsers cannot run an async save-and-leave dialog at unload);
- ordinary one-entry Back via a same-URL, state-preserving history sentinel, capture-phase popstate handling, restoration **before** prompting, and approved traversal past the sentinel. Stay keeps the original route/URL. A sentinel necessarily adds an entry and can replace the browser's forward history when armed.

**No unsupported Next router interception claim:** arbitrary raw `router.push/replace/back`, history-menu multi-entry jumps, framework redirects and document replacements cannot universally be intercepted through Next App Router. Imperative adopted form actions must call the guard; do not treat an onPopState callback as cancellation. Browser/Next interaction, Back/Forward histories and 320px reflow still need U7 runtime acceptance. The guard is not permission to activate a selected-school header or bypass authoritative access. Auth revocation remains terminal; the RAM projection is the recovery path, not continued private-query access.

The modal traps/restores focus, handles Tab/Shift+Tab/Escape, uses named/described dialogs, status/alert announcements and keyboard-reachable actions. Stay remains available during a queued save (it does not cancel an already-sent server write). A late completion cannot approve a newer departure prompt. Recovery discard failures are visible; Resume is disabled during discard. Nested shared dialogs use a topmost-focus stack.

### Progress

Scroll mode says **Page position (not completion)**. Wizard completion counts only required valid non-error sections, never current-step position; absent validation is 0%, not fictional completion. Optional/error/current states are textual/semantic, not color-only. `hidden` suppresses short forms/duplicate steppers; reduced-motion removes bar animation, and save status is a separate live status. Existing form validation remains each adopter's responsibility.

## Verification (final local runs)

```text
pnpm --filter @school/admin exec vitest run __tests__/draft-core.test.tsx __tests__/workspace-shell.test.tsx
  PASS 2 files / 21 tests (14 draft-core DOM/hook tests + 7 U1b shell/seam regressions)
pnpm --filter @school/shared exec vitest run src/drafts src/components/__tests__/MobileProgressIndicator.test.tsx
  PASS 2 files / 14 tests
pnpm --filter @school/convex exec vitest run functions/academic/__tests__/drafts.integration.test.ts
  PASS 1 file / 7 tests
pnpm --filter @school/admin typecheck
pnpm --filter @school/teacher typecheck
pnpm --filter @school/shared typecheck
pnpm --filter @school/convex typecheck
  PASS all four
pnpm exec eslint <changed draft/progress/server implementation and tests, both roots/StaffWorkspace/useDraftConnection files>
  PASS (explicit file list executed)
git diff --check
  PASS; repository LF/CRLF advisories only
```

Total focused bundle: **42 tests passed**. Coverage includes creator/branch denial, unauthenticated/suspended/archived authority, strict schema/version/secret/upload rejection, concurrent revisions/recovery, expiry, stale discard/commit saves, payload erasure and no keystroke audit; awaited failure, debounce, disconnect/reauth, account mismatch, RAM recovery after unmount, submission freeze, queued-save Stay/late completion, focus/keyboard, actual navbar sign-out/link/reload/Back wiring and progress semantics. Back tests simulate popstate/history restoration in jsdom, **not a real Next browser**. No numeric line-coverage claim or screenshot exists. Internal retention job was authored but not executed.

Initial failures were understood and fixed: old tests exercised the now-prohibited unscoped upsert; the Convex test module map required the repository's Windows-safe normalization; vite/client types are not directly available in the Convex workspace; the navbar test required renderLink and opening Account menu before Sign out. All affected checks were rerun, not silenced.

## Files and self-review

Created: shared drafts `registry.ts`, `DepartureGuard.tsx`, `DraftMemory.tsx`, `useDialogFocus.ts`; Admin/Teacher `lib/useDraftConnection.ts`; Admin `__tests__/draft-core.test.tsx`; this result.
Modified: shared `useFormDraft.ts`, types/index, recovery modal; UnsavedBranchSwitchModal, MobileProgressIndicator and its tests; Convex drafts module/integration tests and only the formDrafts schema additions; Admin/Teacher root layouts and the U1b StaffWorkspace callback hookup; U1b test provider wrapper; coverage matrix.

Self-review removed arbitrary upsert/optional revisions, browser-online optimism, fabricated save timestamps, unsafe recovery casts, animation-only progress completion and save-dialog dead ends. Kept creator-only ownership, fixed retention/no-resurrection, no dependency/generated-code edits, no domain-wide refactor and no navbar rewrite. Strict projections, unsupported uploads, create-only entities, explicit allocation and atomic domain completion are intentional safety boundaries, not assertions that all long-form fields are already integrated.

## Handoff / remaining work

- **U3b:** extend reviewed people projections only for actual noncredential fields needed by each form; use explicit instance/recovery UI and transactional enrollment/staff closure. Credentials/photos remain outside drafts. Register actual modal/imperative departures and validators; do not add another progress stepper.
- **U3c:** adopt billing/academic/report configuration and teacher planning; retain authoritative domain assignment checks/existing domain draft APIs. Existing-entity schemas need domain ownership resolvers before enablement. Raw bank/payment secrets remain guard-only, not this draft schema.
- **U4b:** mapping-only projection is safe; source rows/raw files are not permitted. Keep existing import authority/commit review, private file quarantine and scanner gates. Use atomic closure with the accepted import workflow, not speculative submission.
- **U1b:** callback handshake is implemented and tested; selected-branch activation/persistence/reset still waits for scoped route callers. A boolean approval is only permission to begin the separately validated switch, not evidence the switch is safe.
- **U7:** verify actual Next Back/Forward, native reload warning, sign-in return, 320px modal/progress and keyboard behavior using synthetic data. Check imperative callers individually; do not promote arbitrary router/history paths based on the jsdom sentinel test. Schema/function rollout and any eventual cleanup schedule require separate authorization.
