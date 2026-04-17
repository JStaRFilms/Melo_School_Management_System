# T23 Managed School-Site Delivery and Editing Boundaries

## Status

Completed on `2026-04-17`.

## What Changed

1. Added `docs/features/ManagedSchoolSiteDeliveryAndEditingBoundaries.md` to define the managed delivery workflow, editing boundary model, page expansion policy, external-site support, migration path, and service lane rules.
2. Updated `docs/issues/FR-011.md` so the public website issue now reflects the managed delivery / ownership model on top of the T20-T22 runtime foundation.
3. Marked T23 as complete in the orchestrator session master plan and summary.
4. Kept the work docs-only; no application code changed.

## Files Updated

- `docs/features/ManagedSchoolSiteDeliveryAndEditingBoundaries.md`
- `docs/issues/FR-011.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T23_managed_school_site_delivery_and_editing_boundaries.result.md`

## Exact Policy / Workflow Implemented

- New schools are classified as Mode B or Mode C during onboarding.
- The platform delivery team owns template selection from the shared template library.
- The school supplies the factual content pack and approves launch copy before cutover.
- Platform-team-managed areas include layout, canonical routing, SEO defaults, page additions, and launch timing.
- School-admin-editable areas are limited to approved factual content and copy inside the current template contract.
- Page expansion happens through controlled request triage, with reusable pages promoted into the shared system and one-off requests kept inside managed service lanes.
- Schools that keep an external site retain that site as their primary public presence and still receive minimum branded handoff links.
- A Mode B to Mode C migration is a public-web cutover, not a school re-onboarding event.
- Standard, premium, and custom lanes now distinguish launch complexity without introducing a per-school no-code builder.

## Verification Run

- Docs-only change set; no TypeScript files were edited.
- Reviewed against:
  - `docs/Project_Requirements.md`
  - `docs/Coding_Guidelines.md`
  - `docs/issues/FR-011.md`
  - `docs/features/PublicWebOperatingModesAndOnboardingPolicy.md`
  - `docs/features/TenantSchoolPublicSiteEngineAndTemplateSystem.md`
  - `docs/features/PublicSchoolDomainRoutingAndSEO.md`
  - `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`
  - `apps/sites/lib/site.ts`
  - `apps/sites/app/[[...slug]]/page.tsx`
  - `apps/sites/middleware.ts`
  - `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
  - `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`

## Deferred

- Full self-serve page builder
- Freeform CMS editing
- Convex-backed editable site content workflow
- School-specific bespoke code paths

## Notes

- No nested subagents were used.
- No Convex changes were required for this task.
