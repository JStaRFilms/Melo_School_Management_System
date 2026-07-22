# Antigravity CLI — D2 OBHIS Site Mock-up Review

You are independently reviewing the D2 OBHIS website mock-up. Do **not** judge it as a generic landing page. Judge it as a bespoke, code-controlled renderer fed only by approved typed public content.

Do not edit files or implement code. Inspect only the supplied workspace material and return a structured critique.

## Original D2 mission

Turn the OBHIS brief into a bespoke school-first website direction, not a reskin of the existing template. It must preserve a stable external admissions-link contract, work on managed or external domains, and never turn historical booklet facts into approved production content.

## Read these sources

- `docs/mockups/sites/obhis-public-site.html`
- `docs/features/OBHISWebsiteDesignSpecification.md`
- `docs/features/OBHISContentApprovalSheet.md`
- `docs/features/OBHISPublicWebsiteBrief.md`
- `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`
- `docs/decisions/ADR-SharedCoreBespokeSchoolSites.md`
- `docs/features/DesignMilestoneReview.md`

## Data model the UI must render

The renderer receives a B4-validated immutable `SiteRenderContext`, not hard-coded demo data. It owns no tenancy, domains, persistence, permissions, or admissions routing.

### Core context
- active school/domain resolution, canonical origin, route manifest, renderer key `obhis-v1`, immutable published revision ID/version, and safe unavailable state
- drafts are never public: preview is authorized, no-index/no-follow, watermarked, and non-canonical
- only approved public assets are projected; missing/expired/private assets must not appear publicly

### Typed content fields
- `identity`: displayName, shortName, optional motto, logo/fallback text mark, favicon; name/logo/motto are approval-gated sensitive-public values
- home hero: eyebrow, heading, summary <= 280 chars, optional approved hero asset; a deliberate non-photographic fallback is required
- `programmes[]`: bounded records with slug, name, optional descriptor, summary <= 360 chars, optional approved asset, and status
- school-life lead/gallery/features: approved asset refs with caption, alt text, focal point, rights/consent state and expiry
- visit/contact: typed channels, address, hours, directions, visit booking link; absent values are omitted, never replaced with fake contact details
- policies: title, summary, approved policy asset, issued/review dates; hidden when absent
- route SEO: title, description, approved share asset; canonical origin is system-owned
- CTA intent is typed: `application | portal | visit | contact | admissions_info`; it is not an arbitrary URL field

### Link/domain data
- `links.application` is B0-owned `ApplicationLinkV1`: absolute resolved href plus `open | upcoming | paused | closed | unavailable` availability
- all Apply CTAs render the resolved link only; no hard-coded host, price, intake, return URL, iframe, or embedded form/payment
- managed `/apply` is a no-index 307 redirect; external sites use the same absolute link without DNS delegation
- `links.portal` is optional/conditional and never a primary prospective-admissions CTA
- canonical active domain, aliases/redirects, preview/unknown/inactive hosts, and pending domains have distinct safe behavior

### Data/approval constraints
- The historic OBHIS booklet, current demo `obhisSchool` record, booklet fee, contacts, claims, policies, and photographs are reference-only and blocked from public production use
- no stock-child image, invented programme/facility/outcome/safety/medical/statutory claim, fake address/phone, platform branding, or third-party script may be used as fallback
- content absence should omit a section/route or show the shared safe unavailable state—not blank cards, lorem ipsum, arbitrary generic copy, or a deceptive "coming soon" date

## Review criteria

Review the HTML against realistic content states:
1. Full approved content, partial content, no approved imagery, no programmes, unavailable admissions, no portal, no address/contacts, and unpublished policy data.
2. Very long school/programme names, missing descriptor/caption, multilingual/expanded copy, and mobile 320px reflow.
3. Whether routes, nav, CTAs, SEO/canonical behavior, empty states, and media handling are renderable from the typed context without a page builder.
4. Whether it looks bespoke rather than a generic template while retaining accessible semantic landmarks, focus behavior, contrast, target sizes, reduced motion, and performance-aware media.
5. Whether it accidentally treats historical/source-observed content as approved public truth.

## Required response

Return only:
- `Verdict: ready / needs revision / blocked`
- Top 8 concrete issues, ranked by severity
- A table: `page/component | missing/incorrect context field or state | required UI change | severity`
- Required changes to the `obhis-v1` renderer contract before B5
- What is already strong and should not be discarded

Do not give generic aesthetic advice. Do not create a reviewer or make code changes.