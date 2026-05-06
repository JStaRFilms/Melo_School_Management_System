# School Branding and Parent Multi-School Context

## Goal

Make authenticated workspaces visibly school-specific and allow parent portal context to move safely across children in different schools.

## Implemented Scope

- Admin, teacher, and portal workspace navigation accepts active school branding.
- Authenticated school branding is read server-side from the current user membership via `getCurrentSchoolBranding`.
- Workspace navigation shows school logo or fallback initials, active school name, and updates the browser title.
- Portal workspace data now resolves parent-accessible students across multiple active parent memberships that share the same auth identity.
- Student portal users remain direct-context users and only see their own student record.
- Portal child selectors display school context when multiple children are available.
- Portal billing/payment context validates invoice access through accessible student records instead of trusting an invoice ID alone.

## Key Files

- `packages/convex/functions/academic/schoolBranding.ts`
- `packages/convex/functions/portal.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`
- `apps/admin/app/*/layout.tsx`
- `apps/teacher/app/*/layout.tsx`
- `apps/portal/app/(portal)/layout.tsx`
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
- `apps/portal/lib/portal-types.ts`

## Security Rules

- Clients do not pass arbitrary `schoolId` to read authenticated workspace branding.
- Staff branding is derived from the authenticated school membership.
- Parent portal context is derived from active parent user rows linked to the same auth identity.
- Parent selected student IDs must be present in the accessible student set.
- Portal sessions, terms, events, report cards, and billing views are scoped to the selected student's school.
- Student portal users do not get a sibling or multi-school chooser.

## Verification

Passed:

- `corepack pnpm -C packages/shared exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false`
- `corepack pnpm -C apps/portal exec tsc --noEmit --incremental false --pretty false`

Manual checks still recommended:

- Admin nav/title shows the active school.
- Teacher nav/title shows the active school.
- Parent with children in multiple schools can switch child context and sees the selected child's school name.
- Student login lands directly on the student's own context.
- Parent cannot open an unrelated student or invoice by URL.
