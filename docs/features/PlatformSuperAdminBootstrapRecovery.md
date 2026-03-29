# Platform Super Admin Bootstrap Recovery

## Goal

Provide a safe, one-time recovery screen for bootstrapping or restoring the first production platform super admin without relying on a dev-only database record.

This exists so production access can be recovered cleanly after a dev database bootstrap, a lost admin session, or a fresh production deployment.

---

## Components

### Client

- `apps/platform/app/bootstrap/platform-admin/page.tsx`
- `apps/platform/app/bootstrap/platform-admin/PlatformAdminBootstrapForm.tsx`

### Server

- `packages/convex/functions/platform/bootstrap.ts`
- `packages/convex/functions/platform/auth.ts`
- Better Auth sign-up and sign-in endpoints

---

## Data Flow

1. A platform operator opens the hidden bootstrap screen in the platform app.
2. The operator enters the bootstrap token, admin name, admin email, and temporary password.
3. The client submits the request to the existing `bootstrapPlatformAdmin` Convex action.
4. The action validates `PLATFORM_BOOTSTRAP_TOKEN`, reuses or creates the Better Auth account, and upserts the matching `platformAdmins` row.
5. The screen shows success and sends the operator to the normal platform sign-in page.

---

## Database Schema

No new tables or indexes are required.

This flow uses the existing schema:

- `platformAdmins`
- `users` for school-scoped accounts already in the system

The recovery screen only exercises the existing platform bootstrap path and does not change tenant data structures.

---

## Notes

- This is intentionally not part of the normal platform navigation.
- The route is meant for emergency recovery and first-time production bootstrap only.
- The bootstrap token remains the server-side guard for the action.
- After recovery, the operator should sign in normally and treat the screen as an emergency-only tool.
