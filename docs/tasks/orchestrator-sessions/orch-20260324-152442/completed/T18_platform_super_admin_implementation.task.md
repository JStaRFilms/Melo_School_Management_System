# T18 Platform Super Admin Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, `convex-functions`, `convex-schema-validator`, `convex-best-practices`, `frontend-design`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the first real platform-super-admin surface so the product owner can create schools and assign each school its first school admin without using the one-off bootstrap flow.

## Scope

Included:
- dedicated `apps/platform` app surface
- dedicated `platformAdmins` storage model and auth lookup
- platform-super-admin auth gate
- school list view
- create-school flow
- assign-school-admin flow
- pending vs active school status
- safe school slug uniqueness validation
- Better Auth-backed school-admin account provisioning
- clear separation between platform routes and school-admin routes

Excluded:
- custom domains
- billing setup
- school suspension/reactivation
- cross-school analytics
- bulk import
- school deletion
- platform-side editing of school academics

## Context

Use:
- `docs/project_requirements.md`
- `docs/features/PlatformSuperAdminSchoolProvisioning.md`
- `docs/features/SchoolAdminBootstrap.md`
- current Better Auth + Convex integration already present in the repo
- current multi-tenant `schools` and school-scoped `users` model already present in the repo

## Required Decisions Already Locked

Do not reopen these:
- platform admins live in a dedicated `platformAdmins` table
- platform provisioning lives in a dedicated `apps/platform` app
- school admins continue to live in school-scoped `users` rows
- one backend, multi-tenant direction stays intact

## Implementation Requirements

### 1. Platform Data Model

Add the minimum schema needed for platform administration:
- `platformAdmins`
  - `authId`
  - `email`
  - `name`
  - `isActive`
  - `createdAt`
  - `updatedAt`

If school status is not already represented cleanly, add the minimum non-destructive status field required for:
- `pending`
- `active`

Do not weaken existing school-scoped constraints to accommodate platform users.

### 2. Platform Auth Helpers

Implement platform-only auth helpers separate from school membership helpers:
- resolve signed-in Better Auth identity
- map it to `platformAdmins`
- reject inactive platform admins
- keep platform checks out of school-admin helpers unless shared code is genuinely reusable

### 3. Platform Convex Functions

Implement the minimum platform backend:
- list schools with status and assigned-admin summary
- create school
- assign first school admin

Rules:
- slug uniqueness must be enforced server-side
- school creation must not auto-create academic setup data
- school creation should initialize only the minimum tenant shell
- assigning a school admin must:
  - provision a Better Auth account
  - insert a school-scoped `users` row with role `admin`
  - move school status from `pending` to `active`
- no silent merge behavior if the Better Auth email already exists

### 4. Platform App Surface

Implement `apps/platform` with the minimum real workflow:
- sign-in page
- protected dashboard layout
- schools list page
- create-school panel/form
- assign-school-admin panel/form

UX goals:
- clear distinction between platform operations and school operations
- no reuse of the school-admin navigation shell if it muddies role boundaries
- mobile-safe forms and tables/cards
- concise success/error feedback

### 5. Routing And Access

Platform admin:
- can access only platform routes

School admin:
- cannot access platform routes
- continues using the admin app for school operations

Do not grant platform admins access to school-scoped academic pages by default just because they are system owners.

### 6. Bootstrap Relationship

Do not break the existing first-school bootstrap path.

This new platform flow should become the normal path for additional schools, while the bootstrap remains a historical/special-purpose tool.

## File Guidance

Expected areas likely to change:
- `apps/platform/...` new app files
- `packages/convex/schema.ts`
- new platform Convex module(s), for example:
  - `packages/convex/functions/platform/...`
- shared auth helpers only if needed
- docs that must be kept in sync with implementation

Respect the 200-line rule. Split files early instead of creating one giant platform page or one giant backend module.

## Definition Of Done

- a signed-in platform admin can open the platform app
- platform admin can create a school with unique slug
- platform admin can assign the first school admin to that school
- assigned school admin can sign in through the existing admin app
- school status reflects `pending` before admin assignment and `active` after assignment
- school admins cannot access platform routes
- platform implementation does not blur the `platformAdmins` / school `users` boundary
- docs are updated to match the shipped implementation

## Verification

At minimum verify:
- `pnpm typecheck`
- `pnpm test`
- build for any changed app(s)
- live or realistic local smoke test for:
  - platform admin sign-in
  - create school
  - assign school admin
  - school-admin sign-in to the regular admin app afterward

## Deliverables

- working platform-super-admin implementation
- updated feature docs if behavior changed in implementation
- task result note with verification summary and any remaining risks
