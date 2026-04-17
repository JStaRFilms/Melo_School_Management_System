# T20 Multi-Tenant School Public-Site Engine Foundation

## Status

Completed on `2026-04-17`.

## What Changed

1. Created the dedicated tenant public-site app at `apps/sites` with package name `@school/sites`.
2. Added request-time hostname resolution so the app resolves a school from the inbound host header.
3. Added safe failure handling for unknown and inactive hostnames.
4. Added runtime school branding and content loading for:
   - school name
   - logo mark / fallback mark
   - favicon behavior through metadata
   - theme tokens
   - contact details
   - template selection key
5. Kept the tenant public-site surface separate from the SchoolOS marketing site in `apps/www`.
6. Added a generic not-found experience for unresolved hosts and routes.

## Files Updated

- `apps/sites/package.json`
- `apps/sites/next.config.js`
- `apps/sites/postcss.config.js`
- `apps/sites/tailwind.config.js`
- `apps/sites/tsconfig.json`
- `apps/sites/next-env.d.ts`
- `apps/sites/.eslintrc.json`
- `apps/sites/app/layout.tsx`
- `apps/sites/app/globals.css`
- `apps/sites/app/icon.svg`
- `apps/sites/app/[[...slug]]/page.tsx`
- `apps/sites/app/not-found.tsx`
- `apps/sites/lib/site.ts`
- `apps/sites/lib/site-ui.tsx`
- `docs/features/TenantSchoolPublicSiteEngineAndTemplateSystem.md`
- `docs/issues/FR-011.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T20_multi_tenant_school_public_site_engine.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T20_multi_tenant_school_public_site_engine.result.md`
- `scripts/vibe-verify.py`

## Verification Run

- `pnpm --filter @school/sites build` ✅
- `pnpm --filter @school/sites exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/sites lint` ✅

## Notes

- No Convex schema changes were needed for this foundation.
- No nested subagents were used.
