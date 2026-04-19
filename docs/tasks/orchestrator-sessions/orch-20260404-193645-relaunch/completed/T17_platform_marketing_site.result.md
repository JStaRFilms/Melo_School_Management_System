# T17 Platform Marketing Website

## Status

Corrected on `2026-04-17`.

## What Changed

1. Moved the public marketing site from `apps/platform` to `apps/www` so the product story now lives on the public web surface.
2. Restored `apps/platform` root to an internal-only behavior that redirects authenticated users to `/schools` and unauthenticated users to `/sign-in`.
3. Reused the T17 marketing content in `apps/www` with product-facing copy, module sections, packaging guidance, trust signals, and demo/contact CTAs.
4. Removed public marketing CTAs that exposed `/schools` or workspace URLs from the public site.
5. Updated platform branding in `apps/platform` to read as an internal super-admin workspace rather than a public product site.
6. Updated related docs so the platform marketing/site boundary matches the current architecture.
7. No nested subagents were used.

## Files Updated

- `apps/www/app/page.tsx`
- `apps/www/app/about/page.tsx`
- `apps/www/app/academics/page.tsx`
- `apps/www/app/admissions/page.tsx`
- `apps/www/app/fees/page.tsx`
- `apps/www/app/visit/page.tsx`
- `apps/www/app/contact/page.tsx`
- `apps/www/app/layout.tsx`
- `apps/www/app/not-found.tsx`
- `apps/www/lib/site.ts`
- `apps/www/lib/site-ui.tsx`
- `apps/platform/app/page.tsx`
- `apps/platform/app/layout.tsx`
- `apps/platform/app/sign-in/page.tsx`
- `apps/platform/app/schools/SchoolsLayoutClient.tsx`
- `apps/platform/lib/platform-marketing.ts`
- `docs/features/PublicSiteAndSeoFoundation.md`
- `docs/features/PublicWebOperatingModesAndOnboardingPolicy.md`
- `docs/issues/FR-011.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T17_platform_marketing_site.result.md`

## Verification Run

- `pnpm --filter @school/www build` passed
- `pnpm --filter @school/www exec tsc --noEmit -p tsconfig.json` passed
- `pnpm --filter @school/www lint` passed
- `pnpm --filter @school/platform build` passed
- `pnpm --filter @school/platform exec tsc --noEmit -p tsconfig.json` passed
- `pnpm --filter @school/platform lint` passed

## Notes

- The public marketing site is now anchored in `apps/www`.
- The platform app is internal-only and does not present as a public marketing surface.
- T20-T23 remain the place for future school public website work.
