# G2 — Define Shared Managed-Site Core And Bespoke OBHIS Website Architecture

## Role

Act as a principal web-platform architect and digital experience strategist. Balance bespoke school design, reusable SaaS infrastructure, structured content governance, custom domains, maintainable deployments, accessibility, and integration with admissions.

## Objective

Define how the platform can deliver a genuinely bespoke website for Olive Blessed Crest Academy (OBHIS) while retaining shared infrastructure and a repeatable workflow for future schools. Replace visual template rigidity without creating a repository or backend clone per tenant.

## Required Context

Read completely before proposing changes:

- `AGENTS.md`
- `packages/convex/_generated/ai/guidelines.md`
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/master_plan.md`
- `docs/features/TenantSchoolPublicSiteEngineAndTemplateSystem.md`
- `docs/features/ManagedSchoolSiteDeliveryAndEditingBoundaries.md`
- `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`
- `docs/features/PublicSiteAndSeoFoundation.md`
- all source in `apps/sites`
- relevant school branding/domain/admin settings code
- the eight photographs in `C:/CreativeOS/01_Projects/Clients/OBHIS/Enrollment application form`

## Confirmed Decisions

- Shared core with bespoke per-school websites.
- Same monorepo and shared backend; no standard per-school repository clone.
- School admins edit structured factual content, not arbitrary layouts.
- Managed and externally managed websites must link to the same stable admissions application surface.
- Current template/registry implementation is a foundation to refactor, not a constraint to preserve unchanged.

## Source Facts To Reconcile

The photographed booklet identifies the school as Olive Blessed Crest Academy and includes:

- motto/theme around integrity, service, peace, and unity
- welcome message
- vision and mission
- creche, pre-nursery, nursery, primary, secondary, after-school, summer-school, day-care, babysitting/nanny-care claims
- facilities imagery
- parent rules/policies
- address in Federal Housing Estate, Nyanya, Abuja
- phone numbers and `obhischool@gmail.com`
- historical application fee and admissions checklist

The current code contains an `obhisSchool` placeholder with a different display name, location, contact details, branding, and copy. Treat it as demo data, not authoritative client content.

## Scope

Design:

1. The boundary between shared site platform and bespoke school renderer.
2. A refactor of the oversized static `apps/sites/lib/site.ts` registry into maintainable core contracts plus school-specific modules/content loaders.
3. Convex-backed structured site content and branding/domain configuration, including preview/publish/version behavior.
4. A content model that supports factual admin editing while preserving code-controlled composition.
5. A repeatable onboarding workflow: discovery, content pack, information architecture, bespoke design, preview, approval, domain cutover, and ongoing edits.
6. Support for schools with an external website that only need application/portal links.
7. Stable admissions link generation and CTA behavior.
8. OBHIS information architecture, page inventory, content gaps, and visual direction based on supplied material.
9. Asset provenance, image replacement, accessibility, SEO, analytics/privacy, and performance expectations.
10. Deployment and custom-domain ownership, including school-managed DNS.
11. Admin permissions and publication workflow.
12. Testing and regression strategy.

## Questions The Artifact Must Answer

- What remains shared across all managed sites?
- What may be bespoke per school without creating technical debt?
- How are school renderer modules selected at runtime?
- Where does editable content live and how is it previewed/published?
- How do admins change facts without breaking design?
- How do we add a future bespoke school without editing one giant registry file?
- How can an external school website use the same application and portal URLs?
- Should `/apply` render, proxy, or redirect to the dedicated admissions app?
- How is canonical-domain SEO preserved during preview and cutover?
- Which claims and details from the old booklet require explicit client confirmation before publication?

## Expected Artifacts

Write:

- `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`
- `docs/features/OBHISPublicWebsiteBrief.md`
- `docs/decisions/ADR-SharedCoreBespokeSchoolSites.md`

Include:

- goals/non-goals and architecture diagram
- shared-core versus bespoke-module responsibility matrix
- proposed source tree/module boundaries
- content schema/config proposal with indexes and publish/version model
- domain resolution and canonical redirect flow
- external-site integration contract
- admin edit/publish permission model
- reusable client delivery workflow/checklist
- OBHIS sitemap and per-page content outline
- verified facts versus unverified/obsolete claims table
- asset requirements and content questions for the school
- accessibility/SEO/performance acceptance criteria
- phased migration from the current static registry
- file ownership and merge-conflict notes for the integration owner

## Constraints

- Do not implement production code in this Genesis task.
- Do not treat the current placeholder OBHIS record as factual.
- Do not publish minors’ photos from the photographed brochure as reusable website assets; list replacement photography requirements instead.
- Do not build a full page builder.
- Do not clone the repository or provision a separate Convex backend for OBHIS.
- Do not couple the admissions domain to the managed-site renderer.
- Preserve safe unknown/inactive-host behavior and canonical-domain principles.
- Follow Convex generated guidelines for any proposed backend model.

## Definition Of Done

- The architecture supports visually bespoke sites with reusable operations and infrastructure.
- Future schools can follow a documented delivery workflow without inheriting OBHIS design.
- OBHIS has a detailed, source-grounded website brief with factual gaps clearly marked.
- Admin-editable content and code-controlled layout boundaries are explicit.
- The integration contract with admissions works for both managed and external websites.
- The artifacts identify the minimal shared foundation changes required before build worktrees begin.

## Review Checkpoint

Stop after authoring the three artifacts. Report architectural risks, factual/content blockers, likely schema conflicts, and the recommended foundation commit. Do not begin implementation without integration-owner approval.
