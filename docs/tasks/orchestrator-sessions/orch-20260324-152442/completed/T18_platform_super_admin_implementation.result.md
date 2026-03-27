# Task Completion Summary

**Task:** T18 Platform Super Admin Implementation
**Completed At:** 2026-03-27T17:05:00+01:00
**Mode:** vibe-code

## Results

Implemented the first platform-super-admin surface enabling the product owner to create schools and assign school admins without using the bootstrap flow.

### What was built:

1. **Platform Data Model**
   - Added `platformAdmins` table with `authId`, `email`, `name`, `isActive`, `createdAt`, `updatedAt`
   - Added `status` field to `schools` table (`pending` | `active`)
   - Added `by_slug` and `by_status` indexes on schools

2. **Platform Auth Helpers** (`packages/convex/functions/platform/auth.ts`)
   - `getAuthenticatedPlatformAdmin()` - resolves and validates platform admin identity
   - `resolvePlatformAdmin()` - checks if auth ID belongs to active platform admin

3. **Platform Convex Functions** (`packages/convex/functions/platform/index.ts`)
   - `listSchools` - query all schools with status and assigned-admin summary
   - `createSchool` - create school with unique slug validation
   - `provisionSchoolAdmin` - action that creates Better Auth account, inserts school-scoped user row, transitions school to active

4. **Platform App** (`apps/platform/`)
   - Sign-in page with platform-admin-only access
   - Schools list page (table on desktop, cards on mobile)
   - Create-school form with slug auto-generation and validation
   - Assign-school-admin form with Better Auth provisioning
   - Protected layout with platform navigation
   - Full auth flow (Better Auth + Convex integration)

5. **Cross-cutting Updates**
   - Updated `getViewerContext` to recognize platform admins
   - Updated trusted origins to include platform app port (3003)
   - Updated bootstrap to set school status to "active"
   - Updated schoolBranding.ts to preserve status on replace
   - Updated seed.ts to set status on demo school creation
   - Regenerated Convex bindings so platform functions are present in `_generated/api.d.ts`
   - Hardened school-admin provisioning so the backend action enforces platform-admin access explicitly
   - Removed unsupported extra Better Auth sign-up payload fields from platform admin provisioning
   - Updated Turbo typecheck orchestration so Next apps build their route types before package typecheck runs

## Files Created/Modified

### Created:
- `packages/convex/functions/platform/auth.ts` - Platform auth helpers
- `packages/convex/functions/platform/index.ts` - Platform Convex functions
- `apps/platform/package.json` - Platform app package config
- `apps/platform/tsconfig.json` - TypeScript config
- `apps/platform/next.config.js` - Next.js config
- `apps/platform/tailwind.config.js` - Tailwind config
- `apps/platform/postcss.config.js` - PostCSS config
- `apps/platform/.env.example` - Environment template
- `apps/platform/.env.local` - Local environment
- `apps/platform/app/layout.tsx` - Root layout
- `apps/platform/app/globals.css` - Global styles
- `apps/platform/app/page.tsx` - Home page (redirects)
- `apps/platform/app/sign-in/page.tsx` - Sign-in page
- `apps/platform/app/schools/layout.tsx` - Schools layout with nav
- `apps/platform/app/schools/page.tsx` - Schools list page
- `apps/platform/app/schools/create/page.tsx` - Create school form
- `apps/platform/app/schools/[schoolId]/assign-admin/page.tsx` - Assign admin form
- `apps/platform/app/api/auth/[...all]/route.ts` - Auth API route
- `apps/platform/lib/auth-client.ts` - Auth client
- `apps/platform/lib/auth-server.ts` - Auth server
- `apps/platform/lib/AuthProvider.tsx` - Auth context provider
- `apps/platform/lib/ConvexClientProvider.tsx` - Convex provider
- `apps/platform/lib/convex-runtime.ts` - Runtime config helpers

### Modified:
- `packages/convex/schema.ts` - Added platformAdmins table, school status field
- `packages/convex/functions/auth.ts` - Added platform admin viewer context
- `packages/convex/betterAuth.ts` - Added port 3003 to trusted origins
- `packages/convex/functions/academic/bootstrap.ts` - Set status on school creation
- `packages/convex/functions/academic/schoolBranding.ts` - Preserve status on replace
- `packages/convex/functions/academic/seed.ts` - Set status on demo school
- `apps/admin/.env.local` - Added port 3003 to trusted origins
- `apps/admin/.env.example` - Added port 3003 to trusted origins
- `docs/features/PlatformSuperAdminSchoolProvisioning.md` - Checked verification items

## Verification Status

- [x] TypeScript: PASS (`pnpm typecheck` - all 6 packages pass)
- [x] Tests: PASS (`pnpm test` - all 69 tests pass)
- [x] Build: PASS (platform app and admin app both build successfully)

## Remaining Risks

1. **Platform Admin Seeding**: There is no UI or CLI command to create the first platform admin. The `platformAdmins` table must be seeded manually via Convex dashboard or a separate script. This is intentional for security - platform admin accounts should be created with care.

2. **Better Auth Edge Case**: If the Better Auth account creation succeeds but the Convex mutation fails, the auth account will be orphaned. A retry mechanism or cleanup job could be added in the future.

3. **No Password Reset**: The assign-admin form requires manually entering a password. A future enhancement could auto-generate and display a temporary password or send a reset email.

4. **School Slug Immutability**: The slug is immutable after creation as documented. Any future slug editing would need additional safeguards.

5. **No School Suspension**: Out of scope per task requirements. The status field supports `pending` and `active` only.
