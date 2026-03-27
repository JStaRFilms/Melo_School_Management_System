# Standardized Login Flow Error Handling

## Goal

Make admin and teacher sign-in behave the same way when credentials are wrong, an email is malformed, or a user is blocked from the workspace. The login flow should show a clear, consistent message instead of swallowing auth failures or using different copy in each app.

## Components

### Client

- `apps/admin/app/sign-in/page.tsx`
- `apps/admin/lib/AuthProvider.tsx`
- `apps/teacher/app/sign-in/page.tsx`
- `apps/teacher/lib/AuthProvider.tsx`
- `packages/auth/src/sign-in-errors.ts`

### Server

- Better Auth email/password sign-in endpoint
- Convex-backed auth session and role lookup

## Data Flow

1. The user submits email and password from the admin or teacher sign-in page.
2. The shared auth provider trims and validates the email before sending the request.
3. Better Auth returns a safe email/password failure for both "user not found" and "wrong password" cases.
4. The shared error helper normalizes the raw auth error into one consistent user-facing message.
5. The sign-in page renders the standardized message, while unauthorized workspace redirects still use the shared access-denied copy.

## Database Schema

No schema change.

This feature only standardizes client-side error handling for the existing auth flow.

## Regression Check

- Admin and teacher sign-in must keep their current callback destinations.
- Wrong email and wrong password cases must both render a consistent, user-friendly message.
- Empty email and password submissions should still fail locally before any auth request runs.
- Workspace access-denied redirects should keep using the same unauthorized copy on both surfaces.
