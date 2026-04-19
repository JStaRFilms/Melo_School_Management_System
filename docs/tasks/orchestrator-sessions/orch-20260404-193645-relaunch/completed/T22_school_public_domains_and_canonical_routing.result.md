# T22 School Public Domains and Canonical Routing

## Status

Completed on `2026-04-17`.

## What Changed

1. Replaced the public-site hostname list with richer domain-mapping records in `apps/sites/lib/site.ts`.
2. Added per-domain fields for:
   - domain kind
   - public surface
   - pending / verified / active status
   - readiness state
   - SSL readiness
   - canonical intent
   - school-managed DNS posture
   - verification token / record instructions
   - redirect targets for non-canonical hosts
3. Added canonical-domain selection helpers so the public site can resolve the active canonical host from the school’s domain records.
4. Added safe canonical redirect handling in `apps/sites/middleware.ts` for active non-canonical public hosts.
5. Updated public page metadata to use the canonical school origin instead of the request origin.
6. Added school/domain-aware structured data output to the public page renderer.
7. Added host-aware `robots.txt` and `sitemap.xml` metadata routes for active schools.
8. Kept the implementation scoped to `apps/sites` and did not touch authenticated workspace host handoff.

## Files Updated

- `apps/sites/lib/site.ts`
- `apps/sites/lib/site-ui.tsx`
- `apps/sites/app/[[...slug]]/page.tsx`
- `apps/sites/app/robots.ts`
- `apps/sites/app/sitemap.ts`
- `apps/sites/middleware.ts`
- `docs/issues/FR-011.md`
- `docs/features/PublicSchoolDomainRoutingAndSEO.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T22_school_public_domains_and_canonical_routing.result.md`

## Canonical Redirect / Domain Behavior

- Platform-managed public subdomains are modeled as active domain records and can serve as the canonical host.
- School-owned custom domains are modeled with verification state, DNS ownership, and SSL readiness.
- Non-canonical active public hosts redirect with a 308 to the active canonical host.
- Unknown, inactive, and not-yet-active domains fail safely instead of serving content.
- Canonical URLs in metadata, structured data, robots, and sitemap output use the school’s active canonical public host.

## Verification Run

- `pnpm --filter @school/sites build` ✅
- `pnpm --filter @school/sites exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/sites lint` ✅

## Deferred to T23

- Managed school-site delivery workflow
- Optional school-admin editing boundaries
- Page expansion / authoring workflow beyond domain routing

## Notes

- No nested subagents were used.
- No Convex changes were required for this task.
