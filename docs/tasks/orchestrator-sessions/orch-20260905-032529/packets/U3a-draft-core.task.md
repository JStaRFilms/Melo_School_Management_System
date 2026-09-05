# U3a — Shared dirty guard, private drafts and progress contract

## Execution status (2026-09-05)
Core implemented and locally verified: 42 focused tests, Admin/Teacher/Shared/Convex typechecks and changed-file lint passed. U1b root/navbar guard handshake installed; actual form adoption remains U3b/U3c/U4b. Browser evidence E0 and selected-branch activation remain gated. See `../results/U3a.md` (session `results/U3a.md`) for exact contracts, privacy limits, history limitations and handoff. No live operations or commits.

## Objective / scope
Complete one reusable departure/draft framework and accurate mobile progress before form adoption. Not full offline operation or a generic persistence dump.

## Context / dependencies
U1a contract; handshake with U1b without blocking initial shell work. Read H6/H7, actual drafts.ts, shared drafts types/hook/modals and MobileProgressIndicator. Current server API infers legacy school, accepts arbitrary payload and optional revision; hook relies on browser online and retrySave is not awaitable. No app integration exists.

## Ownership
Shared drafts directory, UnsavedBranchSwitchModal, MobileProgressIndicator, new guard contract; academic/drafts.ts; draft/progress tests. Schema/export changes serialized; U1b retains navbar ownership.

## Instructions
1. Register per-form typed payload schema/version, sensitivity, branch/entity context, retention and supported recovery. Server validates allowlisted payload and creator authority; passwords/tokens/payment secrets/raw documents never persist in drafts/localStorage. Keep unapproved local recovery disabled.
2. Protect close/reload, sidebar/link/router/back navigation, modal close and branch/account/sign-out. Expose awaited save-and-leave with stay/discard alternatives and failed-save preservation. Do not claim unsupported Next router interception; test actual departure paths.
3. Provide 1–2s debounce and explicit save, server-confirmed saved state, recovery Preview/Resume/Discard without silent overwrite. Handle real Convex/auth disconnect, revision conflict and reauthentication; retain in-memory edits without promising offline save.
4. Add draft-instance/submission lifecycle so delayed autosave cannot resurrect a submitted/discarded draft. Audit lifecycle, not keystrokes. Private temporary upload references require ownership/type/expiry/scanning controls; no public URLs. Implement retention contract without running cleanup jobs.
5. Progress modes: scroll orientation is not completion; wizard sections complete only on required validation, optional/error/current states and accessible reduced-motion behavior. Avoid duplicate steppers.

## Definition of done / verification
Focused draft tests cover cross-user/branch access, schema rejection, concurrent tabs, failed awaited save, discard/submit stale save, reconnect/reauth and expiry. Shared modal tests cover focus/keyboard/status and progress semantics. Local typechecks/tests recorded; U1b integration tested before full switching completion.

## Artifacts
`results/U3a.md` exact form adapter/guard/server contract, privacy classification rules, commands/self-review, U3b/U3c/U4b handoff. Matrix updated. No production, provider, migration, deploy, credentials or unapproved Convex/PR operations.
