# ADR: Shared Core with Code-Controlled Bespoke School Sites

- **Status:** Accepted for Genesis handoff
- **Date:** 2026-07-22
- **Decision owners:** Integration owner / public-site architecture
- **Related:** `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`, `docs/features/OBHISPublicWebsiteBrief.md`

## Context

The repository has one tenant public-site app, `apps/sites`, but its current model is a finite template catalogue. `apps/sites/lib/site.ts` combines school records, domain records, brand tokens, every page’s content, template layouts, hostname resolution, and SEO helpers. `apps/sites/lib/site-ui.tsx` renders every school with the same shell and section components, reordered by template slots.

That foundation proves useful capabilities—single deployment, host resolution, canonical aliases, safe unknown/inactive hosts, metadata, robots, sitemap, JSON-LD—but does not meet the requirement for genuinely bespoke school experiences. It also has no persisted draft/publish boundary. Its OBHIS object contains demonstrably conflicting demo values and cannot be treated as client content.

The platform must support:

1. a platform-managed public school site;
2. a school’s existing external site linking to platform admissions/portal; and
3. a school with no public website but a shareable admissions link.

School admins need bounded factual editing and publication controls, not a generic page builder. Admissions must deploy independently from a school renderer.

## Decision

Use **one shared site core with compile-time, code-controlled bespoke renderer modules**.

The shared core owns tenant/domain resolution, status, canonical redirects, published/preview content selection, structured content validation, brand/asset projection, canonical admissions/portal links, SEO, analytics adapters, deployment, and safe failure behavior.

Each managed school profile selects an allowlisted `rendererKey`. Its renderer owns custom visual composition and receives only a validated, read-only `SiteRenderContext`. A renderer cannot query persistence directly, resolve domains, load drafts, generate admissions URLs, inject arbitrary scripts, or access another tenant.

Content is stored as versioned structured revisions. Public requests read an immutable published revision only. Authorized preview reads a draft and is always non-indexable. Publish validates the common envelope, renderer schema version, links, and asset approvals before atomically moving the public pointer. Revert clones prior content into a new revision.

The old template catalogue is not the target architecture. It may remain temporarily as an explicit allowlisted legacy adapter for demo tenants. The existing OBHIS record is excluded from authoritative migration.

The canonical admissions experience lives on a configured product-owned surface, symbolically `https://apply.<product-domain>/<schoolSlug>`. The exact production origin is deployment configuration owned by B0, not renderer/content data. Managed `/apply` routes redirect to it; external sites link directly; no-site schools share it directly. The site renderer does not proxy or iframe admissions.

Custom domains use provider-neutral, staged ownership verification and routing. TXT ownership proof is separate from CNAME/host routing and certificate readiness. The platform does not require registrar ownership or DNS delegation from external-site schools.

## Responsibility Boundary

| Shared core | Bespoke renderer |
| --- | --- |
| Host/domain lookup and lifecycle | Custom layout and responsive composition |
| Canonical redirect/origin | School-specific components/styles |
| Published/preview revision selection | Presentation of typed approved fields |
| Common and renderer-schema validation | Renderer-specific field validator/manifest |
| Approved asset/brand projection | Image placement/crop treatment |
| Application/portal link resolution | Approved CTA placement/label rendering |
| Metadata, robots, sitemap, safe JSON-LD | Typed page metadata contribution |
| Analytics/privacy adapter | Semantic event invocation |
| Deployment, monitoring, safe unavailable state | No persistence/deployment responsibility |

## Content Governance Decision

School users may edit structured factual fields, upload assets into a pending-rights state, preview, and—if granted a publisher capability—publish validated content. Sensitive-public fields (contacts, fees, medical/safety/legal claims, admissions requirements, policy text, and child imagery) require explicit current approval evidence. Layout, routes, components, typography implementation, arbitrary HTML/JS/CSS, analytics providers, and deployment remain code/platform controlled.

No page builder will be created.

## Alternatives Considered

### 1. Keep and expand the finite template catalogue

**Pros:** Smallest immediate refactor; current rendering continues.
**Cons:** Visual differentiation remains superficial; school-specific requirements force slot proliferation and conditionals; global registry conflicts grow; OBHIS becomes a reskin rather than bespoke.
**Decision:** Rejected as target. Keep only as a temporary adapter.

### 2. Generic database-driven page/block builder

**Pros:** High admin flexibility; fewer deploys for composition changes.
**Cons:** Expands permissions and validation surface; accessibility/SEO/performance regressions become tenant-configurable; effectively permits layout construction; produces design sameness or unbounded component schemas; conflicts with confirmed managed-service scope.
**Decision:** Rejected.

### 3. Repository/deployment/backend clone per school

**Pros:** Maximum code isolation and unconstrained visual work.
**Cons:** Operational, migration, security, observability, and consistency cost grows per tenant; shared admissions/domain improvements fragment; merge/update debt becomes permanent.
**Decision:** Rejected for normal tenants. Exceptional contractual infrastructure isolation would require a separate future ADR.

### 4. Remote plugin or database-selected module path

**Pros:** Could add renderers outside normal deployment.
**Cons:** Remote-code/supply-chain risk, poor type safety, unpredictable runtime, and difficult rollback.
**Decision:** Rejected. Registry entries are compiled and allowlisted.

### 5. Put the admissions form inside each managed site

**Pros:** Seamless same-origin visual flow.
**Cons:** External/no-site schools cannot share the model; renderer releases can break applications; canonical routes and security duplicate; admissions becomes domain-dependent.
**Decision:** Rejected. Use a dedicated canonical application surface.

## Consequences

### Positive

- Every managed school can have a distinct implementation without a repo/backend clone.
- Shared domain, publication, SEO, security, asset, link, and analytics behavior improves once for all sites.
- Admin factual edits do not expose layout or executable-code controls.
- External and no-site schools remain first-class admissions participants.
- Renderer failures or schema mismatches can fail closed without cross-tenant fallback.
- OBHIS design can proceed from approved source material rather than demo content.

### Costs

- Adding or materially redesigning a renderer requires reviewed code and deployment.
- Renderer data schemas require versioning and migrations.
- The platform needs additive domain/site/revision/asset/audit structures and authorization capabilities.
- A temporary legacy adapter increases migration complexity until demo tenants are converted or retired.
- A managed-service workflow is needed for design/change requests that exceed typed fields.

### Risks

- Renderer field maps could evolve into an implicit page builder. Mitigate with semantic field IDs, bounded typed values, and code-owned route/component manifests.
- Dynamic registry selection could leak or fall back incorrectly. Mitigate with exact allowlist lookup and non-indexable fail-closed output.
- Draft/asset leakage. Mitigate with immutable published pointers, minimal public projections, separate authorized preview, and tenant-isolation tests.
- Domain cutover/SEO damage. Mitigate with staged TXT/routing/TLS readiness, one canonical, preview noindex, and explicit path redirects.
- Stale sensitive facts. Mitigate with approval evidence, review/expiry dates, and sensitive-public publish gates.

## Required Implementation Contracts

B0 must freeze:

- school/site identity and operating modes (`managed`, `external`, `none`);
- permission capability names;
- domain lifecycle and canonical constraints;
- revision envelope, publication pointers, asset rights projection, and audit contract;
- allowlisted renderer descriptor/context boundary;
- canonical `ApplicationLink` and conditional `PortalLink` resolver semantics;
- additive migration compatibility for current `schools` rows.

D2 must provide the OBHIS route/field manifest, responsive visual direction, CTA labels, metadata/asset plan, and approval-aware content treatment.

D3 must provide field-level editor/validator/owner/preview/publish rules and the final permission/action matrix.

B4 implements site core and the legacy adapter after B0/D3. B5 implements `obhis-v1` after B4/D2 and only with approved content/assets.

## Domain and Link Invariants

- One normalized hostname maps to at most one school/surface.
- A managed published site has exactly one active canonical public hostname.
- A custom hostname does not serve public content until ownership, routing, certificate, publication, and renderer readiness pass.
- Alias hosts 308 to canonical HTTPS while preserving valid path/query.
- Preview, unknown, inactive, suspended, pending, and renderer-invalid states are no-index.
- External sites need no platform DNS record merely to link to admissions/portal.
- All contexts receive the same B0-generated application URL for a school.
- Managed `/apply` redirects and never renders/proxies the application.
- Public slugs are stable route identifiers; internal school ID remains authoritative.
- Editable content cannot supply production origins or open redirect targets.

## Migration

1. B0 adds compatible shared contracts and schema; existing schools remain valid without a site profile.
2. B4 introduces core loaders/registry/domain enforcement and an explicit adapter for allowlisted current demo sites.
3. Production/static tenant records are migrated only through reviewed content packs; no implicit fallback creates a public site.
4. The current OBHIS placeholder is disabled/excluded, not copied.
5. D2/B5 introduce `obhis-v1` with approved content and assets.
6. Remove the template adapter after remaining demo tenants are migrated or retired.

## Verification

- Contract tests: tenant isolation, hostname uniqueness, canonical link parity, publication immutability, preview authorization, asset approval, renderer mismatch.
- Site tests: unknown/inactive/pending host, canonical redirects, metadata/robots/sitemap/JSON-LD, unpublished content, legacy adapter allowlist, `/apply` redirect.
- OBHIS tests: no placeholder facts, approval log coverage, responsive/keyboard/contrast/alt text, canonical admissions link, SEO and performance budget.

## Approval and Follow-up

This ADR authorizes architecture/design/foundation planning, not production publication. OBHIS contacts, fees, programmes, policy, health claims, domain, logo, and imagery remain subject to the blockers in `docs/features/OBHISPublicWebsiteBrief.md`.
