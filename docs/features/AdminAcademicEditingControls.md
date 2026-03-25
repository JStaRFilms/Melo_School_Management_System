# Admin Academic Editing Controls

## Goal
Enable school admins to safely edit teachers, subjects, sessions, and class naming details after initial setup without breaking existing academic workflows.

## Status
- Implemented on the admin academic setup routes.
- Backward-compatible class naming support is live for existing schools through a backfill mutation and derived display names.
- Session activation is editable after creation and uses a warning-only safeguard when the currently active session already has live academic data.

## Components

### Client
- Admin teacher management page with:
  - teacher creation
  - teacher selection
  - teacher profile editing
  - admin password reset with temporary password entry
- Admin subject catalog page with create and edit flows
- Admin session management page with:
  - session creation
  - session editing
  - explicit inactive-to-active switching
  - warning banner before switching away from an active session with linked records
- Admin class management page with:
  - `gradeName`
  - optional `classLabel`
  - form-teacher assignment
  - subject offering assignment
  - subject-teacher mapping
- Shared class display formatting reused by admin and teacher selector surfaces

### Server
- Convex academic setup functions exposing:
  - `updateTeacherProfile`
  - `resetTeacherPassword`
  - `updateSubject`
  - `updateSession`
  - `getSessionActivationWarnings`
  - `backfillClassNaming`
- Better Auth admin-enabled operations for teacher profile and password updates
- Class naming compatibility helpers and legacy-record backfill support
- Selector updates so renamed classes and subjects flow through downstream screens without manual cleanup

## Data Flow
1. Admin opens an academic setup page and loads current school-scoped records from Convex.
2. Admin edits a teacher, subject, session, or class naming field in the admin UI.
3. The client calls a Convex mutation or action.
4. Teacher profile and password operations also call Better Auth server APIs with the current admin session headers.
5. Convex updates the school-scoped records and returns the refreshed state for the page.
6. Existing selectors and downstream academic screens continue using the derived display names and renamed records without manual repair.

## Database Schema

### `users`
- teacher records remain school-scoped
- teacher profile edits update `name`, `email`, and `updatedAt`

### Better Auth `user`
- teacher auth records support admin-led email, name, and password updates
- admin auth records must be recognized for admin plugin permissions
- auth user records now support `role` and `schoolId` additional fields for school-aware admin actions

### `subjects`
- existing schema remains, but edits to `name` and `code` are now exposed in the UI

### `academicSessions`
- existing schema remains
- activation changes must preserve the single-active-session rule
- warning metadata is derived from linked enrollment and assessment records

### `classes`
- add compatibility fields:
  - `gradeName`
  - optional `classLabel`
- keep `level`
- keep `name` as the derived display field for compatibility

## Guardrails
- Teacher email edits are normalized to lowercase and rejected when the email already exists for another teacher.
- Teacher password resets revoke the teacher's active sessions after the new password is set.
- A currently active session cannot simply be turned off with no replacement.
- Switching active session remains allowed even when live academic data exists, but the admin sees a warning first.
- Class display names use `gradeName - classLabel` when a label exists, otherwise `gradeName`.
- Existing classes are backfilled so older records still render correctly while new fields roll out.

## Implemented Routes
- `apps/admin/app/academic/teachers/page.tsx`
- `apps/admin/app/academic/subjects/page.tsx`
- `apps/admin/app/academic/sessions/page.tsx`
- `apps/admin/app/academic/classes/page.tsx`
- `packages/convex/functions/academic/academicSetup.ts`
- `packages/convex/functions/academic/adminSelectors.ts`
- `packages/convex/functions/academic/teacherSelectors.ts`

## Verification
- `pnpm -C packages/shared typecheck`
- `pnpm -C packages/convex typecheck`
- `pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
