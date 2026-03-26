# Student House Sync

## Goal
Expose each student's house on the admin edit-profile screen and keep that value synced with the report-card data so the printed `House` field reflects the saved student profile.

## Status
- Implemented.

## Components

### Client
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
  - add a visible `House` input to the edit-student form
  - load the saved house value into local form state
  - submit house updates with the existing student profile save action

### Server
- `packages/convex/schema.ts`
  - store the student's optional house value on the `students` table
- `packages/convex/functions/academic/studentEnrollment.ts`
  - include `houseName` in the student profile query payload
  - persist `houseName` in the student profile update mutation
- `packages/convex/functions/academic/reportCards.ts`
  - compose report cards with the saved student `houseName`

## Data Flow
1. Admin opens `Edit Student Profile`.
2. The page requests the selected student profile from Convex.
3. Convex returns the stored `houseName` together with the existing student profile fields.
4. Admin updates the `House` field and saves the student profile.
5. Convex persists the updated `houseName` on the student record.
6. Report-card queries read the same `houseName` from the student record and surface it in the `House` cell.

## Database Schema

### `students`
- add optional `houseName`
- keep the field on the student profile record so enrollment editing and report-card generation read from one source of truth

## Guardrails
- `houseName` stays optional so existing student records and old schools remain valid
- report cards continue showing a dash when no house has been recorded
- the admin edit form must round-trip an empty house value without breaking other profile fields

## Implemented Routes
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/studentEnrollment.ts`
- `packages/convex/functions/academic/reportCards.ts`

## Verification
- `pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
