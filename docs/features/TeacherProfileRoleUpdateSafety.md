# Teacher Profile Role Update Safety

## Goal

Allow school admins to edit a teacher's display name and login email without touching the teacher's role in Better Auth.

## Components

### Client

- Admin teacher directory form in `apps/admin/app/academic/teachers/page.tsx`
- Validation for normalized name and lowercase email
- Inline success and error feedback for profile edits

### Server

- `packages/convex/functions/academic/academicSetup.ts`
- Better Auth admin update call for teacher profile edits
- Better Auth password reset flow for teacher accounts
- School-scoped `users` row patch for the teacher record

## Data Flow

1. Admin opens an existing teacher record in the teacher directory.
2. The client submits only the normalized name and lowercase email.
3. The Convex action verifies the acting school admin through the app's school-scoped `users` table.
4. The Convex action updates the Better Auth user profile through Better Auth's internal adapter instead of the admin plugin endpoint.
5. Password reset and session revocation also use Better Auth's internal adapter, so they do not depend on the current auth session having a synced Better Auth `admin` role.
6. The Convex mutation patches the school-scoped `users` row with the same name and email.
7. The teacher keeps the original `teacher` role throughout the edit.

## Database Schema

- `users.role` remains `teacher` for teacher records and is not changed by profile edits.
- `users.name` and `users.email` are the editable fields for the school-scoped record.
- Better Auth user metadata mirrors the updated name and email, but not the role.

## Regression Fix

- Removed the temporary `auth.api.updateUser` call that tried to set the acting admin's `role` before teacher edits and password resets.
- Replaced Better Auth admin plugin calls with direct internal-adapter updates after the app-level admin guard passes.
- This avoids Better Auth rejecting the request with `APIError: role is not allowed to be set` and `APIError: You are not allowed to update users`.
- The admin teacher page now shows operation-specific error headers instead of always saying `Teacher not created`.
