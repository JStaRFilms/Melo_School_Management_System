# G2 — Shared-site core and OBHIS website architecture

**Stage:** Genesis
**Role:** Architect (write-capable)
**Dependency:** none
**Worktree:** documentation-only; do not modify runtime code

## Objective

Define a reusable managed-site infrastructure with bespoke, code-controlled school experiences, and produce an evidence-led OBHIS website brief. It must deliberately replace—not extend blindly—the current fixed template assumption in `apps/sites`.

## Required reading

- `00_Handoff_and_Launch_Guide.md`
- `master_plan.md`
- `README.md`
- all `apps/sites/app/**` and `apps/sites/lib/**` code, especially hostname/domain resolution and hard-coded templates/content
- platform school provisioning/domain code and any existing public-site documentation
- `C:/CreativeOS/01_Projects/Clients/OBHIS/Enrollment application form/`

## In scope

1. Audit the present `apps/sites` template model. State which shared capabilities remain (host/domain resolution, canonical redirects, metadata, structured data, deployment, analytics, public links) and which template/layout mechanisms must be retired or isolated.
2. Specify a site-core contract: school resolution, domain records, brand tokens, structured content schema, image/assets, publishing state, admissions/portal external links, SEO metadata, analytics hooks, and renderer registration.
3. Define a bespoke renderer/module boundary: every managed school may use custom code while receiving only typed, approved data from shared site-core.
4. Define three integration patterns: a managed public site, an external existing site that links into admissions/portal, and a school without a public site. Include CNAME/TXT verification, canonical/redirect behavior, and ownership/support boundaries.
5. Define content permissions: what a school admin can edit, publish, preview, and request versus what remains code/deployment-controlled. No page builder.
6. Extract an OBHIS factual inventory from the booklet: verified-looking source text versus unverified operational claims. Produce a content-approval worksheet for name, logo, address, phones, email, fees, programmes, policies, imagery rights, and admissions copy.
7. Propose a credible OBHIS sitemap, CTA model, visual direction, asset shoot/list, accessibility/SEO/performance requirements, and link contract to the new admissions surface.

## Explicit non-goals

- No renderer implementation and no admin UI implementation.
- Do not publish booklet phone numbers, fee values, health claims, or copyrighted images as confirmed production content.
- Do not create a generic drag-and-drop page builder.
- Do not make an external school site depend on platform-owned DNS.

## Required artifacts

1. `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`
2. `docs/features/OBHISPublicWebsiteBrief.md`
3. `docs/decisions/ADR-SharedCoreBespokeSchoolSites.md`

Include current-state audit, proposed module/data boundaries, content permission matrix, domain lifecycle, route/link examples, asset/approval checklist, and phased mapping to `D2`, `D3`, `B0`, `B4`, and `B5`.

## Acceptance checklist

- [ ] Managed and externally hosted schools can use the same canonical admissions URL contract.
- [ ] No tenant visual design is constrained to the existing template catalogue.
- [ ] Admin editing is bounded to typed content and publishing controls.
- [ ] OBHIS copy distinguishes source facts from approvals still needed.
- [ ] Domain verification and canonical redirects are specified without making claims about a registrar or host not yet selected.
- [ ] Shared file changes are listed for the integration owner instead of applied.

## Result handoff

Return artifact paths, the OBHIS approval/asset blockers, the precise shared contracts `D2`, `D3`, and `B0` must consume, and any conflicts with the existing hard-coded `apps/sites/lib/site.ts` model.
