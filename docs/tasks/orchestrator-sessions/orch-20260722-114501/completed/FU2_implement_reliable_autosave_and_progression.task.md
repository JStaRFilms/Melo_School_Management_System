# FU2 — Batch 1 reliable autosave, local recovery, and progression

**Session:** `orch-20260722-114501`
**Stage:** Build follow-up | **Role:** Coder | **Depends on:** FU1 | **Worktree:** `feature/admissions-draft-reliability`

## Objective

Implement a restrained, accessible draft-saving state machine that serializes writes, preserves pending edits locally, and makes **Save and continue** save the active section before advancing.

## Scope

- Continue in the FU1 worktree and preserve the save contract established there.
- Track dirty data by section and field; do not send unchanged values.
- Persist a deliberate, application-scoped local recovery record containing pending editable values and enough metadata to reconcile against the server version. Do not store documents, auth tokens, payment data, or submitted snapshots locally.
- Restore pending edits after refresh/restart without silently overwriting newer server data. Make conflicts visible and recoverable.
- Autosave valid-enough changed draft data after a short debounce and ensure another attempt occurs within 5–10 seconds while unsaved changes remain.
- Flush the active section on blur/navigation and on **Save and continue**. Serialize all writes per application so an older request cannot overwrite a newer edit.
- Retry only transient/offline failures with bounded backoff; deterministic field validation waits for correction.
- Expose concise states: `Saving…`, `Saved just now`, `Offline — changes waiting to sync`, and `Could not save — retrying`.
- Make **Save and continue** validate the current section, focus the first invalid field or linked error summary, save successfully, then advance to the next section.
- Keep errors section-scoped. Clear corrected/successful errors; do not show Child and Form as the active failure in Guardian Contact or Documents.
- Preserve keyboard use, responsive behavior, current design-system styling, changes-requested edit restrictions, and submission locking.
- Add a few focused tests for the autosave/state logic and progression behavior. Do not add browser automation.

## Behavioral details

- Child core progression requires only the current section's required core values and valid currently visible required fields in that section; later contacts/documents/declaration do not block it.
- Guardian Contact progression identifies invalid full name, relationship, email, or phone beside the field. The current server contract does not justify inventing a new Nigerian-only phone rule.
- Neutral section navigation may flush pending valid data, but only **Save and continue** implies advancement after success.
- Multiple tabs/devices retain server-side optimistic concurrency. A conflict must never be retried blindly against a newer version.
- Successful server snapshots may replace local recovery only when they acknowledge the same or newer local edit generation.

## Must not do

- Do not add Batch 2 name fields/migration or Batch 3 document behavior.
- Do not launch an assistant-controlled browser.
- Do not weaken guardian ownership, tenant isolation, immutable submission snapshots, or optimistic concurrency.
- Do not broadly redesign `GuardianSurface` or introduce a new dependency if a small local reducer/hook/helper is sufficient.

## Definition of done

- Changed data autosaves without duplicate/no-op writes and pending changes are attempted at least every 5–10 seconds.
- Refresh/restart restores deliberate local pending edits; offline edits remain visibly pending and retry after connectivity returns.
- Save states are understandable and noninterruptive.
- **Save and continue** advances exactly once after a successful active-section flush and names/focuses invalid fields when blocked.
- Section changes do not leave unrelated stale errors presented as active.
- Focused tests and relevant Apply/Convex type checks pass, with exact commands recorded.

## Expected artifacts

- Narrow changes under `apps/apply/**`, plus only the FU1-established Convex contract/test changes.
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/follow-up/FU2_autosave_progression_result.md` with changed files, decisions, validation, known limitations, and manual-test instructions.

## Self-check and handoff

Before returning, run the narrowest relevant tests/type checks, inspect the complete FU1+FU2 diff, and simplify it. Report any manual browser cases still requiring the user. Do not request an independent reviewer; the integration owner opens FU3 after implementation is complete.
