# School Admin Leadership And Delegation

## Goal

Give each school a single "supreme" or lead admin who can create sub-admins, transfer that leadership to one of those sub-admins when staff changes happen, and optionally upgrade existing teachers without removing their teaching role.

This feature keeps the current school-scoped admin model intact:

- school admins remain school-scoped users
- platform super admins still own cross-school provisioning and school-admin assignment
- admin creation stays inside the school context
- archiving stays soft-delete only, not hard delete

## Why This Exists

The current bootstrap and provisioning flows already create the first school admin, but they do not define:

- which school admin is the lead admin
- how additional school admins are created
- how lead-admin protection works when another admin tries to remove them
- how leadership is transferred when the current lead leaves

Without this, the school can end up with admin accounts that have the same role label but no clear authority boundary.

This feature is the detailed school-side counterpart to the future "school admin recovery and reassignment" roadmap item.

## Scope

### In Scope

- first school admin is marked as the school lead admin
- active school admins can create additional admins within the school
- active school admins can promote other admins within the school
- teachers promoted into school admin access keep their teacher role
- only the current lead admin can transfer leadership to one of their own sub-admins
- the current lead admin cannot be archived or deleted by another admin
- archived admins lose access without being hard-deleted
- platform super admin can still create school admins through provisioning and recovery flows

### Out Of Scope

- school billing permissions
- teacher, student, or parent role changes
- multiple concurrent lead admins per school
- hard delete / permanent purge of admin records
- cross-school admin management from the school app
- cross-school promotion or creation of admins
- leadership transfers to admins outside the current lead's sub-admin chain

## Components

### Client

- `apps/admin/app/admin/page.tsx`
  - admin directory and leadership summary
  - create admin form
  - promote existing teacher form
  - archive admin action
  - transfer leadership action
- `apps/admin/app/admin/layout.tsx`
  - renders the shared workspace navbar for the `/admin` route
- `apps/admin/app/layout.tsx`
  - show lead-admin status in the school admin shell
- future reusable admin-management components
  - admin list row
  - confirmation dialog for archive / transfer
  - access-denied / blocked-state messaging

### Server

- `packages/convex/functions/academic/auth.ts`
  - extend school-admin authorization with lead-admin checks
- `packages/convex/functions/academic/adminLeadership.ts`
  - list school admins
  - create additional school admins
  - promote existing teachers to admins in place
  - archive school admins
  - transfer leadership
- `packages/convex/functions/academic/adminLeadershipHelpers.ts`
  - maintain the school leadership singleton
  - upsert school admin records with lead-aware metadata
  - resolve missing lead-admin records from the existing admin list
- `packages/convex/functions/academic/bootstrap.ts`
  - mark the first bootstrapped school admin as the initial lead admin
- `packages/convex/functions/platform/provisioningHelpers.ts`
  - ensure platform-created school admins are inserted with the correct school leadership state
- `packages/convex/functions/platform/index.ts`
  - create the first school admin for a newly provisioned school and mark them as lead
- `packages/convex/schema.ts`
  - store school leadership metadata

## Data Flow

### 1. First School Admin Is Created

1. Platform super admin provisions a school-admin account, or the one-time school bootstrap creates the first school admin.
2. The system creates the matching Better Auth account.
3. The system inserts the school-scoped `users` row with `role = "admin"`.
4. The system also creates the school's leadership record and marks that admin as the lead admin.
5. The first admin lands in the school admin app with full school-admin access.

### 2. Admin Creates Another Admin

1. Lead admin opens the admin management screen.
2. Lead admin submits the new admin's name, email, and onboarding details.
3. Server verifies the actor belongs to the same school and is an active admin.
4. If the email belongs to an existing teacher, server upgrades that existing user in place, keeps the teacher role, and adds school-admin access.
5. Otherwise, server provisions or reconciles the Better Auth identity and creates the school-scoped `users` row with `role = "admin"` and non-lead status.
6. New or upgraded admin can sign in and operate inside the same school.

### 3. Admin Creates a Sub-Admin

1. Any active admin submits a new sub-admin invite or account form.
2. Server verifies the actor is an active admin in the same school.
3. Server creates the user as a school-scoped admin without leadership privileges.
4. The new account can help run the school, but it does not gain archive authority.

### 4. Admin Promotes Another Admin

1. An active admin selects a sub-admin or other admin they manage.
2. Server checks the actor is active and belongs to the same school.
3. Server updates the target admin's relationship or priority state within the school admin tree.
4. The promoted admin gains the intended admin scope, but does not automatically become the school lead.

### 5. Lead Admin Protection

1. Any admin selects the current lead admin and tries to archive or delete them.
2. Server blocks the request.
3. The lead admin remains protected until leadership has been transferred first.

### 6. Leadership Transfers

1. Current lead admin selects one of their sub-admins.
2. Server checks that the target admin belongs to the same school, is not archived, and is part of the current lead's sub-admin chain.
3. Server updates the school leadership record so the chosen admin becomes the new lead.
4. The previous lead remains an active school admin unless separately archived.
5. The new lead inherits archive authority for other admins.

## Database Schema

### `users`

Keep the existing school-scoped `users` table and extend it with leadership-aware metadata if needed for quick reads:

- `role: "teacher"` can remain in place when a teacher is promoted into school-admin access
- `role: "admin"` is still used for directly created school admins
- `isSchoolAdmin?: boolean` marks school-admin access without removing teaching rights
- `isArchived?: boolean`
- `archivedAt?: number`
- `archivedBy?: id("users")`

Optional helper fields if the implementation needs denormalized reads:

- `isSchoolLeadAdmin?: boolean`
- `leadershipUpdatedAt?: number`
- `managerUserId?: id("users")`

### `schoolAdminLeadership`

Add a school-level singleton table to represent the current lead admin for each school.

Suggested shape:

```typescript
schoolAdminLeadership: {
  schoolId: v.id("schools"),
  leadAdminUserId: v.id("users"),
  previousLeadAdminUserId: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
}
```

Recommended indexes:

- `by_school`
- `by_lead_admin`

Why this table is preferred:

- it keeps the "one lead admin per school" rule explicit
- leadership transfer becomes a single, auditable record update
- the `users` table stays focused on account state
- archive permissions can resolve against one source of truth
- sub-admin relationships stay attached to the current lead admin, so leadership can only pass within that chain

### Better Auth

No new Better Auth role is required for the base plan.

The auth layer should continue to distinguish:

- platform super admin
- school admin
- archived account

The lead-admin distinction lives in the app data model, not in the global auth provider.

## Permissions Model

- platform super admin can create the first school admin during provisioning
- only the current lead admin can transfer leadership
- no admin can archive the lead admin without first transferring leadership
- archived admins cannot create, archive, or transfer anything
- active non-lead admins can create and promote other admins inside the school
- teachers who are promoted into admin access keep their teaching identity
- leadership can only transfer to a direct sub-admin of the current lead

## Regression Guardrails

- do not change the meaning of `users.role = "admin"`
- do not turn the school lead into a platform super admin
- do not allow school admins to cross school boundaries
- do not hard-delete admin history
- do not break the existing bootstrap flow for the first real school admin
- do not break platform provisioning of first school admins
- do not allow leadership transfer to arbitrary admins outside the lead's sub-admin pool
- do not allow any admin to delete the current lead admin

## Acceptance Criteria

- the first admin for a school is clearly identified as the lead admin
- active admins can create and promote other admins
- leadership can be transferred only to one of the lead admin's sub-admins
- the current lead admin cannot be deleted by another admin
- archived admins lose access immediately
- school admin history remains readable after archiving or transfer

## Implementation Notes

- the new school-admin dashboard now points at `functions/academic/adminLeadership:*`
- the first admin inserted during bootstrap or platform provisioning is automatically recorded as that school's lead admin
- if a school is missing a lead record, the app can recover by treating the oldest active admin as the implicit lead until the record is repaired
- non-lead admins can create and promote other admins, but lead transfer remains restricted to the current lead's direct sub-admins
- the current lead cannot be archived by another admin, which preserves the transfer-before-removal rule
- the create-admin screen now offers both a brand-new admin path and a teacher-promotion path
- promoting a teacher reuses the existing user row and auth identity, so the same email does not create a duplicate account

## Definition Of Done

- the school has a clear internal leadership model
- admin management is explicit instead of implied
- the feature fits the existing school-scoped data model
- future build work can wire the UI and Convex functions without reopening product questions
