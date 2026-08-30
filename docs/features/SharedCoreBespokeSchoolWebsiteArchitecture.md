# Shared-Core, Bespoke School Website Architecture

**Status:** Genesis architecture for G2
**Decision record:** `docs/decisions/ADR-009-shared-core-bespoke-school-sites.md`
**Related brief:** `docs/features/OBHISPublicWebsiteBrief.md`

## 1. Purpose

Provide one managed public-site platform in `apps/sites` while allowing each managed school to have a code-controlled, visually bespoke renderer. Shared infrastructure resolves the school, domain, approved content, links, SEO, assets, publication state, and analytics hooks. A renderer receives a validated, read-only payload; it does not own tenancy, DNS, persistence, permissions, or admissions routing.

This deliberately replaces the finite visual-template assumption in `apps/sites/lib/site.ts`. It does not create a repository, deployment, or Convex backend per school.

### Goals

- A managed school can have genuinely custom composition and styling without forking the platform.
- Managed sites, external school sites, and schools without a website use the same canonical admissions-link contract.
- School admins edit bounded factual content and control draft/preview/publish actions according to permission; they do not construct layouts.
- Custom-domain verification, canonical redirects, safe unknown-host behavior, metadata, structured data, assets, and deployment stay shared.
- Public rendering consumes only a validated published revision. Draft data is available only through an authorized, no-index preview.

### Non-goals

- No drag-and-drop or arbitrary block page builder.
- No arbitrary HTML, JavaScript, CSS, analytics scripts, route creation, or component placement by a school admin.
- No per-school repository/backend/deployment clone.
- No coupling between the admissions application app and a managed-site renderer.
- No requirement for an externally hosted school to delegate DNS to the platform.
- No production implementation, schema change, or UI change in G2.

## 2. Current-State Audit

### 2.1 What exists

`apps/sites` is a single Next.js app with a catch-all route. `apps/sites/lib/site.ts` contains types, five templates, all school/domain records, all content, host resolution, page resolution, theme generation, metadata, JSON-LD, robots, and sitemap helpers. `apps/sites/lib/site-ui.tsx` contains one global header/footer and one set of section components. Templates differ mainly by visibility and ordering of the same slots.

Request flow today:

```text
Host header
  -> static hostname index in apps/sites/lib/site.ts
  -> static SchoolConfig + TemplateKey
  -> fixed PageKey and PageSlot lookup
  -> generic PublicSchoolPage in apps/sites/lib/site-ui.tsx
  -> shared metadata/JSON-LD/robots/sitemap helpers
```

### 2.2 Concrete findings

| Severity | Finding | Evidence and consequence |
| --- | --- | --- |
| **Blocker** | The current OBHIS record is fabricated demo content and conflicts with the supplied booklet. It must never be promoted as client content. | `apps/sites/lib/site.ts` defines `obhisSchool` as “Obhis Heritage Academy,” with Enugu address, `.example` email, invented phone numbers, copy, and `obhis.test`; the booklet says Olive Blessed Crest Academy and points to Nyanya, Abuja. |
| **High** | Tenant, domain, template, and content concerns are fused into one oversized static module. | `apps/sites/lib/site.ts` is 1,569 lines and exports the static `schools` array plus rendering/SEO/domain contracts. Adding a school edits a conflict-prone global registry and requires a deploy even for factual copy. |
| **High** | The finite template catalogue constrains visual design. | `TemplateKey`, `schoolTemplates`, `PageKey`, and `PageSlot` in `apps/sites/lib/site.ts`; `PublicSchoolPage` in `apps/sites/lib/site-ui.tsx` always uses the same header, footer, hero, cards, and CTA components. Slot order changes, but composition is not bespoke. |
| **High** | There is no persistent draft, approval, publish, rollback, or audit boundary. | Content is executable source in `apps/sites/lib/site.ts`; every source edit is immediately the next deployed public value. There is no Convex-backed public-site content model. |
| **High** | Domain readiness is modeled but not enforced as a complete lifecycle. | `resolveSchoolFromHostname` checks `domain.status === "active"` but does not require `readiness === "ready"` and `sslStatus === "ready"`. Static tokens/instructions also live in source. |
| **High** | Link fields accept arbitrary strings and there is no canonical application/portal resolver. | `LinkAction.href` in `apps/sites/lib/site.ts`; current admissions CTAs are contact, phone, or email links. Managed and external sites therefore have no shared admissions contract. |
| **Medium** | Canonical scheme depends on request headers rather than deployment-owned canonical configuration. | `buildCanonicalPublicOrigin` uses `x-forwarded-proto` and otherwise emits `http`. Production must explicitly trust the edge proxy and/or use a configured canonical scheme. |
| **Medium** | Redirect responsibility is duplicated. | `apps/sites/proxy.ts` redirects aliases, and `apps/sites/app/[[...slug]]/page.tsx` repeats a redirect check. A single core redirect decision should own status, path, and query preservation. |
| **Medium** | SEO output is generic or inaccurate in places. | `buildOpenGraphImageUrl` always uses `/og-image.png`; JSON-LD uses a plain address string; sitemap `lastModified` is request time rather than publication time. |
| **Medium** | Template launch readiness is descriptive only. | `SchoolTemplateConfig.launchReady` is never enforced before rendering. |
| **Medium** | Analytics and privacy hooks are absent. | No analytics adapter/event boundary exists in `apps/sites`; arbitrary per-school script injection must not become the remedy. |
| **Medium** | Asset provenance and image consent are absent. | A URL can be placed in branding, but there is no rights status, alt text, consent scope, review state, focal point, or publication gate. |
| **Low** | Unknown and inactive hosts already fail safely. | `resolveSchoolFromHostname`, `buildMissingSiteMetadata`, `robots.ts`, and `not-found.tsx` return no-index/unavailable behavior. This is a capability to preserve. |

### 2.3 Preserve, refactor, retire

| Treatment | Capability |
| --- | --- |
| **Preserve as shared behavior** | Host normalization; hostname-to-school resolution; unknown/inactive safe failure; one `apps/sites` deployment; canonical alias redirects; dynamic metadata; robots; sitemap; manifest; JSON-LD safety escaping; favicon/brand asset fallback; route/path preservation; platform and custom domains. |
| **Refactor behind contracts** | Domain records and lifecycle; canonical-origin selection; branding tokens; content loading; asset URLs; page inventory; SEO fields; application/portal links; analytics; publication timestamps. These move from static source to shared core and reviewed persisted configuration. |
| **Retire as the target model** | Finite `TemplateKey` catalogue as a requirement, fixed `PageKey`/`PageSlot` composition, all-school `schools` source array, all-school content in `site.ts`, and the assumption that every site uses `PublicSchoolPage`. |
| **Isolate temporarily** | Existing Greenfield/Aster/Legacy demo data and generic renderer may survive only in an explicit `legacy-template` adapter during migration. It must be allowlisted, tested, and removable. The current OBHIS demo record is not an acceptable migration source. |

## 3. Recommended Architecture

```text
                         +-----------------------------+
Request host/path ------>| Shared site-core            |
                         | - trusted host normalization |
                         | - domain/school resolution   |
                         | - canonical redirect policy  |
                         +--------------+--------------+
                                        |
                                        v
                         +-----------------------------+
                         | Published content loader     |
                         | - school/site profile        |
                         | - immutable published rev    |
                         | - approved assets/brand      |
                         | - canonical links            |
                         | - SEO + analytics config     |
                         +--------------+--------------+
                                        |
                           validated SiteRenderContext
                                        |
                                        v
                         +-----------------------------+
                         | Code renderer registry       |
                         | rendererKey -> module        |
                         | - obhis-v1                   |
                         | - future-school-x-v1         |
                         | - legacy-template (adapter)  |
                         +--------------+--------------+
                                        |
                                        v
                         React output + core SEO/robots/sitemap

Admin typed editors -> mutable draft -> validation -> preview (noindex)
                    -> approval/publish -> immutable public revision

External school website ----------------> canonical ApplicationLink
No public website ----------------------> canonical ApplicationLink/share URL
Managed renderer CTA -------------------> same canonical ApplicationLink
```

### 3.1 Component boundaries

| Shared site-core owns | Bespoke renderer owns |
| --- | --- |
| Trusted hostname parsing and domain lookup | Page composition, visual hierarchy, component implementation |
| School/site status and operating mode | School-specific typography application and motion within approved tokens |
| Domain verification/readiness/canonical decisions | Responsive navigation presentation |
| Published versus preview revision selection | Rendering the registered route set |
| Validation of common content and renderer payload | Renderer-specific payload validator and field manifest |
| Asset approval, signed/public URL resolution, alt text and focal data | How approved images are cropped/presented |
| Brand token normalization and contrast-safe fallback | Bespoke use of the normalized tokens |
| Canonical application and portal link resolution | Placement and labels of approved CTAs |
| Metadata primitives, canonical URL, robots, sitemap, JSON-LD sanitization | Optional page-specific metadata contribution from typed fields |
| Analytics adapter and privacy rules | Calling approved semantic event hooks only |
| Safe missing/inactive/unknown/renderer-error response | Site-specific error presentation inside safe bounds |
| Deployment, monitoring, cache invalidation | No deployment or data access responsibility |

A renderer **must not** query Convex directly, derive school identity from the host, generate an admissions URL, inspect draft records, inject scripts, or accept unvalidated content. Its only public entry is conceptually:

```ts
interface SiteRenderer<TData> {
  key: string;                       // e.g. "obhis-v1"
  schemaVersion: number;
  routes: readonly SiteRouteDefinition[];
  validateRendererData(input: SiteFieldMap): TData;
  render(context: SiteRenderContext<TData>): React.ReactNode;
}

interface SiteRenderContext<TData> {
  school: PublicSchoolIdentity;
  brand: PublishedBrand;
  contact: PublishedContact;
  common: PublishedCommonContent;
  rendererData: TData;
  assets: Readonly<Record<string, ApprovedPublicAsset>>;
  links: { application: ApplicationLink; portal?: PortalLink };
  seo: PublishedSeoProfile;
  publication: { version: number; publishedAt: number };
  analytics: PublicAnalyticsHooks;
  request: { routeKey: string; canonicalUrl: string; preview: boolean };
}
```

`SiteRenderContext` is illustrative architecture, not production code. B0 must freeze actual shared names and validators.

### 3.2 Renderer registration

Use a small, explicit, code-owned registry that maps a stable `rendererKey` to a module descriptor/dynamic import. Each renderer lives in its own folder with its own route manifest, typed data validator, components, tests, and metadata contribution. Adding a school-specific renderer adds one module and one registration entry; it does not modify host/domain logic or a global content catalogue.

Recommended source boundary:

```text
apps/sites/
  app/[[...slug]]/page.tsx           # thin shared request adapter
  core/
    domain/                           # host normalization, resolution, redirects
    content/                          # public/preview loaders and envelope validation
    links/                            # consumes B0 canonical link resolver
    assets/                           # public asset projection
    seo/                              # metadata, JSON-LD, robots, sitemap
    analytics/                        # approved provider adapters/events
    renderers/
      contract.ts
      registry.ts                     # small code-owned manifest only
  renderers/
    legacy-template/                  # temporary adapter
    obhis-v1/                         # B5; no core ownership
      definition.ts
      schema.ts
      routes.ts
      components/
      __tests__/
```

Do not auto-discover arbitrary database module names or accept a module path from content. `rendererKey` must match an allowlisted compiled module. An unknown key produces a non-indexable unavailable response and an operational alert; it never falls back to another school’s renderer.

## 4. Site-Core Data Contract

### 4.1 Public-site profile

One profile per school records:

- `schoolId` and immutable school slug reference
- operating mode: `managed`, `external`, or `none`
- site status: `draft`, `review`, `published`, `suspended`, or `retired`
- allowlisted `rendererKey` and renderer schema version for managed mode only
- external primary website URL for external mode only
- current draft revision and published revision pointers
- canonical public domain reference for managed mode
- publication policy and required approval state
- analytics adapter configuration (provider enum and public site ID only; no arbitrary script)
- created/updated audit fields

The profile must not duplicate admissions pricing or application state. It stores/derives only an approved link reference from B0.

### 4.2 Domain record

A shared `schoolDomains` record should include:

- `schoolId`, normalized ASCII hostname, surface (`public` initially)
- kind (`platform_subdomain`, `custom_domain`, optional advanced school subdomain)
- lifecycle status and readiness (Section 7)
- canonical intent (`canonical` or `redirect`) and optional canonical target reference
- ownership (`school_managed_dns` or `platform_managed_dns`)
- verification method, token hash/value presentation, record name and expected target
- certificate state
- verification/activation timestamps and actors
- last check result and bounded operational reason code

Required indexes should follow the Convex naming rule and field order, at minimum:

- unique lookup: `by_hostname`
- school operations: `by_schoolId_and_surface_and_status`
- verification worker: `by_status_and_nextVerificationCheckAt`

Global hostname uniqueness and exactly one active canonical public domain per managed profile must be enforced transactionally, not inferred from array order.

### 4.3 Brand tokens

Public branding is publication-controlled and separate from the existing operational `schools.logoStorageId` compatibility field. The published revision contains/references:

- approved display name and short name
- approved logo asset and favicon asset
- fallback text mark
- color roles (not arbitrary CSS variable names): primary, secondary, accent, background, surface, text, muted text, focus
- typography pack key selected from a code allowlist, or renderer-owned typography
- optional tone/tagline field

School admins may propose colors/assets, but validation checks format, contrast-critical combinations, file type/size, and rights. A renderer can transform roles into its own visual system but cannot consume arbitrary CSS.

### 4.4 Structured content

A revision is a bounded, schema-versioned content envelope:

- common identity/contact/location fields
- navigation labels/visibility allowed by the renderer field manifest
- approved page copy fields keyed by stable semantic field IDs
- programmes/services as bounded structured records
- policy summaries and downloadable approved policy assets
- galleries as references to separately stored approved assets
- CTA labels plus typed link intent (`application`, `portal`, `contact`, `visit`, or reviewed external URL)
- per-route SEO title, description, share asset, and publication timestamp
- renderer-specific fields represented by a bounded typed `SiteFieldValue` union and validated by the registered renderer schema

Allowed rich text is a restricted document AST (paragraphs, headings within permitted levels, lists, emphasis, and links). Raw HTML, script, iframe, style, event handlers, and embedded forms are forbidden. Cardinality and serialized-size limits must be enforced before write/publish. Galleries, audit events, and other potentially growing collections stay in separate tables rather than unbounded arrays, in line with Convex guidance.

### 4.5 Revision and publish model

- A new site starts with a mutable draft revision and no public output.
- Draft saves use optimistic concurrency (`version`/`updatedAt`) to avoid silent overwrite.
- Preview resolves the draft only for an authenticated, authorized school member or a short-lived opaque token stored hashed. Preview is `noindex, nofollow`, excluded from sitemap, and uses a non-canonical preview host/path.
- Publish performs one server-side transaction: authorize, validate common schema, resolve renderer, validate renderer schema version and all assets/links, create/freeze an immutable published revision, update the profile pointer, and append an audit event.
- Public requests read only the published pointer. They never “use latest.”
- Revert clones an earlier immutable publication into a new draft; it does not mutate history.
- Renderer schema upgrades require an explicit migration/compatibility function and preview approval before the profile points to the new renderer/schema version.
- Cache keys include school ID plus published revision ID. Publication invalidates only that tenant’s site and metadata cache.

### 4.6 Assets

Each public-site asset record must include:

- school ID and storage ID
- type/purpose (`logo`, `favicon`, `hero`, `gallery`, `staff`, `facility`, `document`, `social-share`)
- filename, media type, dimensions, size, checksum
- alt text (or explicit decorative flag)
- focal point where supported
- rights status (`pending`, `approved`, `rejected`, `expired`)
- rights basis/source, approver, approval/expiry date
- for identifiable children, documented consent scope and expiry; absence blocks public use
- moderation/review status and lifecycle (`draft`, `published`, `retired`)

Public loaders project only approved, non-expired assets referenced by the published revision. Storage IDs and internal rights notes are not sent to the renderer. Public assets should be transformed/optimized at delivery; admissions/private documents are a different storage boundary and can never be selected as website assets.

### 4.7 SEO and structured data

Core owns:

- canonical origin from the active canonical domain record, not free-form content
- canonical path from the renderer’s allowlisted route manifest
- no-index behavior for preview, unknown, inactive, suspended, missing renderer/content, and non-active domain states
- page title/description validation and safe OG/Twitter image projection
- sitemap from published renderer routes, with `lastModified` from publication/content timestamps
- robots referencing only the canonical sitemap
- safe JSON-LD serialization

The renderer may contribute typed page semantics, but organization name, address, phone, email, programme claims, and images enter JSON-LD only when their corresponding public fields are approved. Use structured PostalAddress fields instead of one unchecked string. Alias hosts issue redirects and do not produce competing indexable content.

### 4.8 Analytics hooks

Core exposes semantic events such as `site_page_view`, `application_cta_selected`, `portal_cta_selected`, `contact_selected`, and `visit_selected`. A code-owned adapter maps these to an approved provider. Rules:

- no arbitrary admin-supplied script/HTML
- no child/applicant details, form values, phone/email, auth IDs, or sensitive data in events
- school ID should be a non-sensitive internal/opaque tenant key, not user-provided text
- query attribution keys are allowlisted and bounded
- consent/cookie behavior follows the chosen provider and applicable policy
- renderer code calls hooks; it does not initialize providers

## 5. Proposed Convex Ownership (for B0/B4, Not Applied Here)

The exact schema is integration-owner work. Recommended bounded tables are:

| Table | Purpose | Key indexes |
| --- | --- | --- |
| `schoolSiteProfiles` | Mode, status, renderer key/version, draft/published pointers, canonical domain, analytics adapter | `by_schoolId`; `by_status` |
| `schoolDomains` | Host ownership, verification, TLS/readiness, canonical behavior | `by_hostname`; `by_schoolId_and_surface_and_status`; `by_status_and_nextVerificationCheckAt` |
| `schoolSiteRevisions` | Draft and immutable published content envelopes | `by_schoolId_and_state_and_version`; `by_schoolId_and_version` |
| `schoolSiteAssets` | Public asset metadata, rights, consent, and lifecycle | `by_schoolId_and_status`; `by_schoolId_and_kind_and_status` |
| `schoolSiteAuditEvents` | Append-only edit/preview/publish/revert/domain events | `by_schoolId_and_createdAt`; `by_actorUserId_and_createdAt` |
| `schoolSitePreviewTokens` (only if shareable previews are approved) | Hashed, expiring, revision-bound preview capability | `by_tokenHash`; `by_schoolId_and_expiresAt` |

Do not place growing audit/gallery collections inside a single Convex document. Every public Convex function requires validators. Public unauthenticated queries should return a minimal projection by normalized active hostname/revision, while writes and previews derive identity server-side and authorize school membership. Sensitive/internal operations use internal functions. Follow `packages/convex/_generated/ai/guidelines.md` during implementation.

### Compatibility

The current `schools` table contains name, slug, status, and optional operational logo fields only (`packages/convex/schema.ts`). Platform provisioning creates only name/slug/status (`packages/convex/functions/platform/index.ts`). School branding exposes a fallback theme and operational logo (`packages/convex/functions/academic/schoolBranding.ts`). Therefore:

1. B0 adds site structures additively; it must not make existing school rows invalid.
2. A missing `schoolSiteProfile` means “no managed site configured,” not “render a generic site.”
3. Existing internal workspace logo behavior remains compatible; public brand publication may initially seed from it only through an explicit reviewed migration.
4. Legacy static demo sites may use an allowlisted adapter during B4. They are not silently copied into authoritative content.
5. OBHIS starts from an approved content pack, never from `obhisSchool`.

## 6. Content Permission and Control Matrix

Permissions should be capabilities, not assumptions based only on an `admin` label. D3 refines UX; B0 supplies authorization primitives.

| Action/content | Site content editor | Site publisher / lead school admin | Platform delivery | Platform ops | Renderer developer |
| --- | --- | --- | --- | --- | --- |
| Edit approved factual draft fields | Yes | Yes | Yes, with audit | No routine edit | No production data edit |
| Upload asset | Yes, starts pending rights | Yes | Yes | No routine edit | No |
| Approve image rights/child consent | No unless explicitly delegated and documented | School factual/consent confirmation | Validate evidence | No | No |
| Preview own school draft | Yes | Yes | Yes | Support-only | Local fixtures only |
| Publish standard copy | No | Yes after validation/approval | Yes only under managed-service permission | Emergency suspend only | No |
| Publish sensitive-public fields (fees, contacts, health/safety claims, legal/policy text) | Propose | Confirm school approval | Co-review and publish per policy | Emergency suspend | No |
| Revert publication | Request | Yes, creates new revision | Yes with audit | Emergency suspend | No |
| Add/reorder components or routes | Request only | Request only | Triage/request | No | Code change and review |
| Select/change renderer | Request/approve direction | Approve direction | Propose and coordinate | Activate after readiness | Code/review only |
| Configure arbitrary HTML/JS/CSS/script | Never | Never | Never | Never | Only reviewed repository code, not content |
| Request custom domain | Yes | Yes | Guide/verify content readiness | Verify/activate platform mapping/TLS | No |
| Change DNS at school provider | School DNS owner | School DNS owner | Provide records/support | Verify only | No |
| Change canonical domain/cut over | Approve | Approve | Coordinate | Activate/rollback | No |
| Configure admissions/portal destination | Choose approved link intent | Approve availability | Validate | B0-owned resolver/config | Renderer only places typed intent |

### Field classes

- **Standard factual:** hours, approved programme summaries, staff role labels, visit instructions. Editable in draft and publishable by a site publisher.
- **Sensitive-public:** phone/email/address, fees, legal/statutory claims, medical/safety claims, admissions requirements, policy wording, child imagery. Requires current explicit approval evidence before publish.
- **Code-controlled:** layout, components, route manifest, renderer typography implementation, animation, data fetches, analytics providers, deployment. Request only.

Every mutation and publication records actor, school, revision, changed field IDs, time, and reason. Site permissions do not grant access to admissions applications or documents.

## 7. Domain Lifecycle and Canonical Behavior

### 7.1 Managed custom domain

```text
requested
  -> verification_pending (platform supplies TXT ownership challenge)
  -> verified (ownership confirmed)
  -> routing_pending (platform supplies CNAME/host target)
  -> certificate_pending
  -> ready
  -> active alias or active canonical
  -> suspended/retired if necessary
```

TXT proves control; CNAME (or host-supported apex alternative) routes traffic. Exact record names/targets depend on the selected hosting and DNS provider and must be generated during onboarding. This architecture does not claim a registrar, DNS host, certificate vendor, CNAME flattening behavior, or apex record type.

Activation requires ownership verification, host routing, certificate readiness, published content, renderer availability, and school cutover approval. Do not switch canonical SEO before all are ready.

### 7.2 Redirect rules

- Exactly one active canonical public host per managed school.
- Every other active managed public host issues a `308` to the canonical HTTPS origin, preserving the allowlisted path and query string.
- Redirect targets come from a domain record reference, never an admin-entered full redirect URL.
- Pending/verified/certificate-pending hosts do not render indexable content.
- Unknown, inactive, suspended, or cross-tenant mismatched hosts show safe unavailable output and disallow crawling.
- Preview hosts never become canonical and always return no-index headers/metadata.
- Cutover preserves old route mappings through an explicit redirect map; unknown arbitrary slugs should not all redirect to home.

### 7.3 Trust boundary

Only trust `Host`/forwarded headers from the configured edge path. Normalize case, trailing dot, port, and internationalized names before indexed lookup. Canonical scheme is HTTPS in production from deployment configuration/domain state, not a client-controlled header. Development host overrides remain explicit and cannot introduce production tenant mappings.

## 8. Three Integration Patterns

### Pattern A — Managed public site

- `school.example` is school-owned DNS and maps to `apps/sites` after TXT verification and the host-specific routing record.
- `www.school.example` can be the canonical or a 308 alias; one is selected before launch.
- Renderer is selected by the persisted allowlisted `rendererKey`.
- Public requests receive only the published revision.
- “Apply” resolves to B0’s product-owned canonical application URL. A convenience `/apply` route should issue a temporary `307` redirect to that canonical URL and be `noindex`; it must not proxy, iframe, or duplicate the application form.
- Portal CTA resolves through the canonical portal-link helper and is shown only when enabled/approved.

Example (symbolic deployment origin):

```text
https://www.school.example/admissions
  CTA -> https://apply.<product-domain>/<schoolSlug>
https://www.school.example/apply
  307 -> https://apply.<product-domain>/<schoolSlug>
```

### Pattern B — Existing external school site

- The school remains responsible for its website, hosting, TLS, content, analytics, cookies, accessibility, SEO, and DNS.
- The platform does not require or control a public domain mapping for that site.
- The platform supplies the same canonical application and portal URLs plus optional approved link/button guidance.
- The external site links directly; it must not iframe the application or copy a tenant form endpoint.
- If a future migration to managed hosting is requested, it follows a separate preview/approval/domain-cutover project. Existing SEO redirects remain jointly planned.

```text
https://existing-school-site.example/admissions
  link -> https://apply.<product-domain>/<schoolSlug>
```

No TXT/CNAME is required merely to link. DNS verification begins only if the school asks the platform to serve a managed hostname.

### Pattern C — School without a public site

- `schoolSiteProfiles.mode = none`; no `apps/sites` hostname is inferred or published.
- The school can share the canonical application URL directly from messaging, print, or platform-approved directories.
- The portal URL can likewise be shared when the portal is enabled.
- Unknown hostnames do not fall back to a generic school page.
- A future managed/external mode change retains the same school slug/ID and application-link contract.

## 9. Canonical Public Link Contract

B0 must own a shared resolver usable by `apps/sites`, `apps/apply`, admin previews, and external-site onboarding materials. It may be implemented with different final names, but it must preserve these semantics:

```ts
type ApplicationLink = {
  kind: "application";
  schoolId: Id<"schools">;
  schoolSlug: string;
  canonicalUrl: string;       // product-owned configured origin + encoded stable route
  intakeSlug?: string;        // only after validated availability
};

type PortalLink = {
  kind: "portal";
  canonicalUrl: string;
  schoolSlug?: string;        // presentation hint only, never authorization
};
```

Contract rules:

1. Canonical pattern is deployment-configured, illustrated as `https://apply.<product-domain>/<schoolSlug>`; no renderer or content field hard-codes the production origin.
2. The resolver validates that the school is active and admissions are publicly available. An unavailable programme yields a typed unavailable state, not a guessed URL.
3. `schoolId` is authoritative internally; the stable unique slug is the public route identifier. Slug changes require alias/redirect migration.
4. Optional intake/product segments are returned only from admissions configuration. Sites cannot invent them.
5. Attribution parameters are allowlisted (`source=managed_site`, `source=external_site`, campaign token) and never affect tenant authorization or canonical metadata.
6. No `returnTo`/open-redirect parameter comes from editable content.
7. Portal school context is a display/entry hint; authenticated membership remains the authorization source.
8. Managed `/apply` redirects; the admissions application is never rendered or proxied by the bespoke renderer.

This gives all three website modes the same destination and lets admissions deploy independently.

## 10. Reusable Delivery Workflow

1. **Classify mode:** managed, external, or no-site; record ownership/support boundaries.
2. **Discovery:** audience, objectives, programmes, differentiators, legal/health claims, language, accessibility needs, domain/DNS owner, analytics/privacy needs.
3. **Content pack:** collect structured facts, copy, brand files, policies, links, current URL inventory, and explicit approvers.
4. **Asset provenance:** record source, photographer/license, identifiable-person consent, expiry, alt text, and allowed channels.
5. **Information architecture:** D2-style sitemap, route goals, CTA funnel, metadata plan.
6. **Bespoke design:** code-controlled renderer direction and field manifest; no tenant layout controls.
7. **Implementation:** register renderer, build with fixtures, validate against current site-core contract.
8. **Draft import:** load approved structured fields/assets into a draft revision; no public availability yet.
9. **Preview and QA:** school factual approval; delivery a11y/responsive/SEO/performance review; admissions/portal link test.
10. **Domain preparation:** issue provider-neutral TXT and routing instructions; verify ownership/routing/TLS.
11. **Publish and cutover:** publish immutable revision, activate canonical host, enable aliases/redirect map, submit sitemap only after readiness.
12. **Operate:** typed edits, audit, preview, publish/revert, rights expiry monitoring, domain renewal/DNS support boundary, periodic fact review.

## 11. Verification Strategy

### Contract/backend

- Hostname global uniqueness and tenant isolation.
- Unknown/inactive/pending/TLS-not-ready domains cannot render.
- Exactly one active canonical public domain.
- Public query cannot read drafts, pending assets, storage IDs, or another school.
- Preview authorization/token expiry and no-index behavior.
- Concurrent draft update conflict; publish validation; immutable published revisions; revert-by-clone.
- Renderer key/schema mismatch fails closed.
- Canonical application link is identical for managed/external/no-site contexts.

### Site core

- Host normalization behind trusted proxy; path/query-preserving 308 aliases.
- Safe unknown/inactive/renderer-error behavior.
- Legacy adapter only for allowlisted demo tenants.
- Canonical metadata, sitemap publication timestamps, robots, JSON-LD escaping and approved-field projection.
- `/apply` 307 to the B0 link; no proxy/iframe.
- No arbitrary scripts or unapproved content values reach output.

### Renderer

- Route manifest and field schema fixtures.
- Desktop/mobile, keyboard navigation, focus visibility, reduced motion, contrast, semantics, alt text.
- Missing optional content/assets produce intentional layouts, not invented placeholders.
- Core Web Vitals and image/font budgets from the tenant design specification.

## 12. Phased Migration

### B0 — shared foundation (integration owner)

- Freeze school/site identity, operating modes, permission names, domain record/lifecycle, revision envelope, asset approval projection, `ApplicationLink`/`PortalLink`, and compatibility rules.
- Add additive schema/indexes and contract tests; do not make site records mandatory for existing schools.
- Provide canonical link resolver and auth capabilities without feature UI.

### D2 — OBHIS design

- Consume this renderer/content boundary and `OBHISPublicWebsiteBrief.md`.
- Produce route manifest, visual specification, renderer field manifest, responsive behavior, metadata/asset plan, and approved CTA labels.
- Do not approve facts; preserve approval status.

### D3 — structured content/admin design

- Consume the permission matrix, field classes, revision lifecycle, domain states, and asset rights states here.
- Define each field’s editor, validator, owner, preview rule, publication gate, conflict/revert UX, and support request path.
- Return the exact B0/B4 permission/action matrix.

### B4 — site core

- Replace static production resolution/content with B0 records and shared loader.
- Implement registry, validation, preview/publish reads, assets, links, SEO, analytics hooks, domain lifecycle enforcement, and legacy demo adapter.
- Do not implement OBHIS visual composition or change admissions domain code.

### B5 — OBHIS renderer

- Start only after B4 and D2.
- Build `obhis-v1` from approved fields/assets; never import the current placeholder OBHIS config.
- Verify CTA, factual approval log, accessibility, SEO, responsive behavior, and performance.

## 13. Shared-File Changes for the Integration Owner (Not Applied in G2)

Likely conflict-prone changes to centralize in B0:

- `packages/convex/schema.ts`: additive tables/indexes and compatible school references.
- shared validators/types location selected by B0: site identity, permission, domain, publication, field-value, asset projection, and link contracts.
- Convex functions under a reviewed public-sites boundary and generated API reconciliation.
- environment/deployment contract for application origin, portal origin, trusted host/proxy behavior, and sites canonical production scheme.
- package/workspace manifests only if the shared contract package requires exports/dependencies.

B4 owns `apps/sites/**`. D3/B4 must receive explicit ownership before changing any admin content route. G2 has not modified any of these shared/runtime files.

## 14. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Dynamic custom code becomes an unreviewed plugin system | Compile-time allowlisted registry only; no database module paths or remote code. |
| “Structured content” drifts into a page builder | Stable semantic field IDs and renderer-owned manifests; no component, route, style, or script fields. |
| One renderer schema change breaks published data | Versioned descriptors, explicit migration, preview approval, fail-closed mismatch. |
| Public query leaks drafts or cross-tenant assets | Published pointer projection, indexed hostname lookup, school authorization, separate preview path, contract tests. |
| Convex document growth | Bound content envelope/cardinality/size; separate galleries/assets/audit; no unbounded arrays. |
| Custom-domain cutover damages SEO | Provider-neutral staged verification, TLS readiness, one canonical, path redirects, preview noindex, delayed sitemap. |
| Admin publishes stale fee/contact/health claim | Sensitive-public class, current approval evidence, expiry/review dates, dual gate. |
| Analytics captures applicant data | Core-owned semantic adapter, allowlisted properties, no renderer/provider scripts. |
| Legacy demo data becomes authority | Explicit adapter allowlist; missing profile means no site; OBHIS placeholder excluded. |
| External sites are accidentally coupled to platform DNS | Direct canonical links require no DNS change; DNS lifecycle applies only to managed hosting. |

## 15. Acceptance Criteria

- A managed renderer can be added without editing host/domain resolution or a global school-content registry.
- No managed school is visually constrained by the old template catalogue.
- Every public render uses an immutable validated published revision and approved asset projection.
- Admins can edit/preview/publish/revert only according to typed permissions; no layout/page-builder controls exist.
- Managed, external, and no-site schools receive the same B0-generated canonical admissions URL.
- Managed `/apply` redirects to admissions; it does not render/proxy the form.
- TXT ownership and CNAME/host routing are distinct, provider-neutral steps; active canonical routing requires TLS readiness.
- Preview/unknown/inactive/pending hosts are non-indexable and cannot expose another tenant.
- OBHIS implementation cannot consume the current `obhisSchool` placeholder as approved content.
- Shared-file changes remain integration-owner work; G2 changes documentation only.
