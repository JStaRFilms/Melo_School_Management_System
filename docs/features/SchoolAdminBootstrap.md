# School Admin Bootstrap

## Goal

Provide a safe, one-time bootstrap path for creating the first real school admin and school record before the full platform super-admin provisioning flow exists.

## Why This Exists

- `T16` gives a school admin the tools to run a school.
- `T17` will later provide the proper multi-school platform-super-admin provisioning flow.
- Until `T17` exists, the first real school admin still needs a controlled bootstrap path.

## Scope

Included:
- create a school by slug if it does not already exist
- provision a real Better Auth admin account
- insert or reconcile the matching school-scoped `users` row with role `admin`
- optionally create the first session
- optionally create the first term

Excluded:
- full platform super-admin UI
- school billing setup
- custom domains
- repeated public onboarding flow

## Security Model

- bootstrap is protected by a dedicated Convex env token
- the token is intended for one-time CLI-driven setup
- after bootstrap, the token can be removed from the deployment env

## Data Flow

1. CLI invokes a guarded Convex action with bootstrap token and school/admin payload.
2. Action provisions or resolves the Better Auth user.
3. Internal mutation creates or reconciles:
   - `schools`
   - admin `users` row
   - optional `academicSessions`
   - optional `academicTerms`
4. Action returns the created/resolved ids and final login email.

## Definition Of Done

- first real school admin can sign in
- that admin lands in the admin app with school-scoped access
- the school can start using the `T16` academic setup flow immediately
