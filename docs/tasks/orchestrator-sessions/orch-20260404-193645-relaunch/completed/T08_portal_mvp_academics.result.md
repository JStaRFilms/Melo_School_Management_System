# T08 Portal MVP Academics

## Status

Completed on `2026-04-10`.

## What Changed

1. Bootstrapped a real `apps/portal` Next.js workspace for parent and student access:
   - app layout
   - sign-in route
   - guarded portal layout
   - dashboard, report-card, result-history, and notifications routes
2. Added portal auth/runtime wiring in `apps/portal/lib/*` using the same Better Auth + Convex pattern as the other workspaces, with a safe no-Convex fallback for local builds.
3. Added a portal-safe academic query in `packages/convex/functions/portal.ts` that:
   - resolves accessible students for parent and student users
   - loads report-card history and the active report-card view
   - derives academic notifications from report-card state and school events
4. Exported report-card helpers from `packages/convex/functions/academic/reportCards.ts` so portal report-card rendering can reuse the existing report-card model.
5. Activated the shared portal workspace in navigation:
   - `packages/shared/src/workspace-navigation.ts`
   - `packages/shared/src/components/WorkspaceNavbar.tsx`
6. Synced rollout docs and FR tracking:
   - `docs/features/PortalAcademicPortalFoundation.md`
   - `docs/features/UnifiedWorkspaceNavbar.md`
   - `docs/issues/FR-009.md`
   - `docs/design/sitemap.md`

## Files Updated

- `apps/portal/package.json`
- `apps/portal/next.config.js`
- `apps/portal/tsconfig.json`
- `apps/portal/postcss.config.js`
- `apps/portal/tailwind.config.js`
- `apps/portal/next-env.d.ts`
- `apps/portal/app/layout.tsx`
- `apps/portal/app/globals.css`
- `apps/portal/app/api/auth/[...all]/route.ts`
- `apps/portal/app/(auth)/sign-in/page.tsx`
- `apps/portal/app/(portal)/layout.tsx`
- `apps/portal/app/(portal)/page.tsx`
- `apps/portal/app/(portal)/report-cards/page.tsx`
- `apps/portal/app/(portal)/results/page.tsx`
- `apps/portal/app/(portal)/notifications/page.tsx`
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
- `apps/portal/lib/AuthProvider.tsx`
- `apps/portal/lib/ConvexClientProvider.tsx`
- `apps/portal/lib/auth-client.ts`
- `apps/portal/lib/auth-server.ts`
- `apps/portal/lib/convex-runtime.ts`
- `apps/portal/lib/portal-types.ts`
- `packages/convex/functions/portal.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `packages/shared/src/workspace-navigation.ts`
- `packages/shared/src/components/WorkspaceNavbar.tsx`
- `docs/features/PortalAcademicPortalFoundation.md`
- `docs/features/UnifiedWorkspaceNavbar.md`
- `docs/issues/FR-009.md`
- `docs/design/sitemap.md`

## Verification Run

- `pnpm --filter @school/portal exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/shared exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/portal lint` ✅
- `pnpm --filter @school/portal build` ✅
- `pnpm --filter @school/admin build` ✅

## Notes

- The portal currently supports single-school parent/student academic access and intentionally leaves advanced multi-school child/school selection for a later slice.
- Portal build output intentionally degrades to a static-safe preview when `NEXT_PUBLIC_CONVEX_URL` is missing so local verification can still pass.
- Billing and payment work remains out of scope for this task and is still queued as `T09`.
