# T21 School Website Template Library and Page Composition

## Status

Completed on `2026-04-17`.

## What Changed

1. Added five template families to the public-site design contract:
   - modern campus
   - classic institutional
   - primary garden
   - secondary studio
   - faith tradition
2. Added per-page composition contracts that control ordered section slots and page visibility.
3. Wired the public-site renderer so pages are built from template-driven section ordering instead of one-off page layouts.
4. Added runtime support for core public pages using the template contract:
   - home
   - about
   - academics
   - admissions
   - fees
   - visit
   - contact
5. Left room for future school-specific pages through the template contract and supported future-page lists.

## Files Updated

- `apps/sites/lib/site.ts`
- `apps/sites/lib/site-ui.tsx`
- `apps/sites/app/[[...slug]]/page.tsx`
- `docs/features/TenantSchoolPublicSiteEngineAndTemplateSystem.md`
- `docs/issues/FR-011.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T21_school_website_template_library_and_page_composition.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T21_school_website_template_library_and_page_composition.result.md`

## Verification Run

- `pnpm --filter @school/sites build` ✅
- `pnpm --filter @school/sites exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/sites lint` ✅

## Notes

- This is structured flexibility, not a full no-code site builder.
- No nested subagents were used.
