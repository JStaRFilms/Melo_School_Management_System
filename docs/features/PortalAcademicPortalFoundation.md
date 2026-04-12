# Portal Academic Portal Foundation

## Goal
Give parents and students a real mobile-first portal where they can sign in, choose the correct child context, and review report cards, result history, and academic notifications without touching the admin or teacher workspaces.

## Components

### Client
- `apps/portal/app/layout.tsx`
- `apps/portal/app/(auth)/sign-in/page.tsx`
- `apps/portal/app/(portal)/layout.tsx`
- `apps/portal/app/(portal)/page.tsx`
- `apps/portal/app/(portal)/report-cards/page.tsx`
- `apps/portal/app/(portal)/results/page.tsx`
- `apps/portal/app/(portal)/notifications/page.tsx`
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
- `apps/portal/lib/AuthProvider.tsx`
- `apps/portal/lib/ConvexClientProvider.tsx`
- `apps/portal/lib/portal-types.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`
- `packages/shared/src/workspace-navigation.ts`

### Server
- `packages/convex/functions/portal.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `packages/convex/functions/academic/auth.ts`

## Data Flow
1. The portal app boots with the same Better Auth + Convex pattern used by the other workspaces.
2. The sign-in screen uses the portal callback URL and returns authenticated parents and students to the portal root.
3. The portal workspace query resolves the school, the accessible student list, the selected child context, and the current academic term.
4. Report-card and result-history screens use the same school-scoped portal query data so the child selector stays synchronized across views.
5. Academic notifications are derived from report-card readiness, term reminders, and upcoming school events.

## Database Schema

No new tables were required.

The portal reuses existing academic records:
- `users`
- `families`
- `familyMembers`
- `students`
- `classes`
- `academicSessions`
- `academicTerms`
- `schoolEvents`
- `reportCardComments`
- `assessmentRecords`

## UX Direction
- Mobile-first cards and selectors should be the default layout.
- Parents with more than one child in the same school should be able to switch the active child quickly.
- Students should land on their own records without extra context selection.
- The report-card view should keep the printable sheet intact and readable on small screens.
- Notifications should feel useful, not noisy; keep them to a short prioritized list.

## Regression Checks
- Portal sign-in should still work when Convex is configured.
- Parent and student accounts should be rejected from admin/teacher workspace routes.
- Cross-school records must never be shown in the portal.
- Report-card links should stay tied to the selected child, session, and term.
- The portal should still render a usable fallback when Convex is not configured during local builds.

## Implemented Outcome
- The portal app is now bootstrapped with auth, layout, and workspace routing.
- Parents and students can enter a school-scoped dashboard.
- The portal includes report-card, result-history, and notification surfaces.
- The shared workspace navigation now includes a live portal destination.
- Future cross-school parent chooser work can build on this foundation without rewriting the portal.
