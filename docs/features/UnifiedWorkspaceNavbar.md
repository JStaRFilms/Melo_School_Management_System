# Unified Workspace Navbar

## Goal

Create one shared workspace navigation contract for the admin, teacher, and student-facing portal experiences so users see a consistent top navigation, keep the same area-switch entry point, and stop bouncing between mismatched route lists.

## Components

### Client

- `packages/shared/src/workspace-navigation.ts`
- `apps/admin/lib/navigation/WorkspaceNavbar.tsx`
- `apps/admin/lib/navigation/WorkspaceSwitchPanel.tsx`
- `apps/admin/app/switch-areas/page.tsx`
- `apps/admin/app/academic/layout.tsx`
- `apps/admin/app/assessments/layout.tsx`
- `apps/teacher/lib/navigation/WorkspaceNavbar.tsx`
- `apps/teacher/lib/navigation/WorkspaceSwitchPanel.tsx`
- `apps/teacher/app/switch-areas/page.tsx`
- `apps/teacher/app/enrollment/layout.tsx`
- `apps/teacher/app/assessments/exams/layout.tsx`

### Server

No server changes.

## Data Flow

1. Shared workspace metadata defines the available areas, labels, route groups, and default destinations for admin, teacher, and portal.
2. Each app-level navbar reads the current pathname and active workspace, then resolves the correct local section links and workspace-switch destinations from the shared metadata.
3. Admin route-group layouts and teacher route-group layouts render app-local navbar views backed by the same shared navigation metadata instead of maintaining independent route lists.
4. The app-local `switch-areas` pages use the same shared metadata so users can move between workspaces from a single consistent screen.
5. Portal is now a live workspace destination in the navigation model, so the area switcher can route to the authenticated parent/student portal instead of a placeholder.
6. The admin workspace now includes a dedicated Finance/Billing link so school billing surfaces remain discoverable without mixing them into assessment routes.

## Database Schema

No schema change.

The feature only reorganizes client-side navigation and route metadata.

## Implemented Outcome

- Admin, teacher, and portal routes continue to share one navigation contract.
- The admin workspace now exposes a billing entry point alongside academic and assessment sections.
- The shared workspace switcher remains the single route catalog for all app shells.

## Regression Check

- Admin academic and assessment routes must still enforce admin-only access.
- Teacher enrollment and exam routes must still allow teacher and admin access.
- Existing deep links such as `/academic/teachers`, `/assessments/setup/exam-recording`, `/assessments/exams/entry`, and `/enrollment/subjects` must remain reachable.
- The new navbar must not hard-redirect users away from the section they are already using.
- Area switching should continue to preserve the current host/origin while sending users to the appropriate workspace root for admin, teacher, or portal.
