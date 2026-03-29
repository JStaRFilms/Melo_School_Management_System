# Exam Editing Restrictions

## Goal
Allow school admins to turn on exam editing restrictions with an optional start time and a required stop time, with server-enforced rules that apply to both teacher and admin result-entry screens.

## Status
- Implemented
- Extends `docs/features/ExamRecording.md`
- Maps to FR-007: Results Entry and Moderation

## Scope

### In Scope
- Admin-managed exam editing window for a selected session and term
- Optional editing start date
- Required editing stop date once restrictions are enabled
- Server-side enforcement for both teacher and admin save operations
- Read-only access to existing sheets when editing is blocked
- Clear lock-state messaging in teacher and admin result-entry flows
- Admin ability to turn each control on or off

### Out Of Scope
- Approval or publication workflow states
- Per-student locks
- Per-teacher custom windows
- Background auto-publish behavior

## Components

### Client
- `apps/admin/app/assessments/setup/exam-recording/page.tsx`
  - add policy controls for:
    - target session
    - target term
    - `restrictionsEnabled`
    - optional `editingStartsAt`
    - required `editingEndsAt`
- `apps/admin/app/assessments/results/entry/page.tsx`
  - render active lock status for the selected sheet
  - disable score inputs and save actions when editing is blocked
- `apps/teacher/app/assessments/exams/entry/page.tsx`
  - render the same lock status
  - disable score inputs and save actions when editing is blocked
- shared result-entry workspace components
  - accept an editability state and reason instead of assuming every loaded sheet is editable

### Server
- `packages/convex/functions/academic/assessmentEditingPolicies.ts`
  - add admin-only query/mutation support for assessment editing policies
- `packages/convex/functions/academic/assessmentRecords.ts`
  - return the active editing policy and computed editability state with each sheet
  - reject writes when the sheet is outside the allowed window or finalized
- shared authorization/policy helpers
  - resolve the policy for `(schoolId, sessionId, termId)`
  - compute `canEdit` and a user-facing lock reason from server time
- `packages/shared/src/exam-recording/editing-policy.ts`
  - shared lock-state resolver used by backend enforcement and verified with unit tests

## Data Flow
1. A school admin opens Exam Protocol settings and selects the target session and term.
2. The admin optionally turns on the editing window, enters the allowed start and end dates, and optionally turns on finalization with a finalization date.
3. The client saves the policy through an admin-only Convex mutation.
4. When a teacher or admin opens a result-entry sheet, the sheet query loads the policy for that session and term and computes the effective edit state from server time.
5. The result-entry UI shows one of:
   - editable
   - locked until the editing start time
   - locked because the editing stop time has passed
6. On save, the mutation recomputes the same policy rules on the server before writing any row.
7. If the policy blocks editing, the mutation rejects the save even if someone bypasses the UI.
8. If the admin later turns the restriction off or changes the dates, the new policy applies immediately to future loads and saves.

## Database Schema

### New Table: `assessmentEditingPolicies`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `sessionId` | id | Academic session targeted by the policy |
| `termId` | id | Academic term targeted by the policy |
| `editingWindowEnabled` | boolean | Enables or disables the restriction rule |
| `editingWindowStartsAt` | number? | Optional start time |
| `editingWindowEndsAt` | number? | Required stop time when restrictions are enabled |
| `finalizationEnabled` | boolean | Legacy compatibility field, no longer used by the UI |
| `finalizeAt` | number? | Legacy compatibility field, folded into stop-time evaluation for older rows |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | Admin user who last changed the policy |

### Indexes
- `by_school`
- `by_school_session_term` on `[schoolId, sessionId, termId]`

### Derived Runtime State
The following values should be computed at query/mutation time, not stored:
- `canEdit`
- `lockReason`
- `isWithinEditingWindow`
- `isFinalized`

## Enforcement Rules
- Only school admins can create or update an editing policy.
- A missing policy means the current v1 behavior stays open for editing.
- If restrictions are enabled and a start time is present, saves are allowed only at or after `editingWindowStartsAt`.
- If restrictions are enabled, saves stop once server time is after `editingWindowEndsAt`.
- Date checks must use server time, not browser time.
- Query access can remain read-only even when editing is blocked so staff can still review saved scores.
- Admin changes to the policy must update `updatedBy` and `updatedAt` for traceability.

## Validation Rules
- `editingWindowEndsAt` is required when restrictions are enabled.
- `editingWindowStartsAt` is optional, but if present it must be before `editingWindowEndsAt`.
- Policies are school-scoped and cannot target another school's session or term.
- Only one policy row should exist per `(schoolId, sessionId, termId)`.

## Regression Check
- Schools with no editing policy must continue working exactly as they do now.
- Teacher assignment authorization must still be enforced before editability is evaluated.
- Admin result entry must still work for any class-subject sheet inside the school when no lock is active.
- Existing `assessmentRecords` rows should not need migration for this feature.
- Result-entry screens should remain usable in read-only mode when a sheet is locked.

## Assumption For Build
This blueprint assumes the admin can reopen editing by changing or disabling the restriction later, but only through the admin-controlled settings flow and with audit metadata preserved.

## Implemented Routes
- `apps/admin/app/assessments/setup/exam-recording/page.tsx`
- `apps/admin/app/assessments/setup/exam-recording/components/AssessmentEditingPolicyCard.tsx`
- `apps/admin/app/assessments/results/entry/page.tsx`
- `apps/teacher/app/assessments/exams/entry/page.tsx`
- `apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx`
- `apps/admin/app/assessments/results/entry/components/AdminRosterGrid.tsx`
- `packages/convex/functions/academic/assessmentEditingPolicies.ts`
- `packages/convex/functions/academic/assessmentEditingPolicyHelpers.ts`
- `packages/convex/functions/academic/assessmentRecords.ts`
- `packages/convex/schema.ts`
- `packages/shared/src/exam-recording/editing-policy.ts`

## Verification
- `pnpm -C packages/shared exec tsc --noEmit --incremental false --pretty false`
- `pnpm convex:codegen`
- `pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
