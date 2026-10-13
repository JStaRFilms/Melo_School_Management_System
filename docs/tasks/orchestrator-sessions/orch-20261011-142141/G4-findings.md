# Connection and draft-state findings

## Report 5
The user sees a warning below the navbar that pushes content down, and sees the warning despite internet connectivity.

## Verified code evidence
- `apps/admin/lib/useDraftConnection.ts:6` uses Convex `isWebSocketConnected`, not browser `navigator.onLine`. Internet connectivity does not imply this socket is connected.
- `apps/admin/app/academic/students/page.tsx:1192` renders the family draft controls as an ordinary content-flow element above the student editor. Conditional rendering adds height.
- `packages/shared/src/drafts/useFormDraft.ts` sets `connection_lost` after previously available state is lost. The available/reconnection branch clears a pause but does not update the status itself. With a clean form, autosave cannot subsequently update it, so a prior warning can remain even when the socket is connected.
- The same availability value also includes account and context equality. A scope mismatch can be labelled connection loss despite a connected socket.
- `packages/shared/src/drafts/types.ts:57` combines connection loss with recovery pending and claims changes are in browser memory without distinguishing an untouched form.
- `apps/admin/lib/StaffWorkspace.tsx` owns the admin navbar integration. `packages/shared/src/components/WorkspaceNavbar.tsx:625` has a fixed-height header suitable for a consistent status slot.

## Proposed change
Separate live connection state from draft recovery state. Report backend reconnecting, authentication required, draft save failure, and connected-with-unsaved-recovery as distinct states. Do not promise disk persistence or call a server disconnection no internet. Only describe unsaved changes when they actually exist.
Use one reserved header slot for active workspace status. Keep actionable form recovery modals and Retry/Preview controls, but stop duplicating banners in normal document flow. Preserve mobile and keyboard access without wrapping the header into extra height.
Fix stale reconnect state and scope-change classification without enabling unreviewed overwrites.

## Regression checks for build
1. Connected browser with disconnected backend displays server reconnecting, not no internet.
2. Clean form disconnect/reconnect clears the stale warning.
3. Dirty form reconnect separates healthy connection from recovery required.
4. Account/school/form-context changes do not create false socket-loss copy.
5. Header height and content top position stay unchanged when status changes, including mobile.
6. Save/preview/retry preserves optimistic revisions, account isolation, and draft recovery safeguards.

## Validation limits
Read-only source investigation. No application behavior has been verified in a running browser yet.
The fresh worktree has no installed app dependencies. The Vitest version check failed; no unit test success is claimed.
