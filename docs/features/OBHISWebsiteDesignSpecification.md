# OBHIS Website Design Specification — `obhis-v1`

**Status:** D2 design source of truth for B5; factual content and brand assets remain approval-gated.
**Depends on:** `OBHISPublicWebsiteBrief.md`, `SharedCoreBespokeSchoolWebsiteArchitecture.md`, `ADR-SharedCoreBespokeSchoolSites.md`, and `ADR-AdmissionsApplicationSurfaceAndLifecycle.md`.
**Companion mockup:** `docs/mockups/sites/obhis-public-site.html`
**Companion approvals:** `docs/features/OBHISContentApprovalSheet.md`

> This specification approves the *information architecture, visual language, and component behavior*, not the historical booklet facts. B5 must render only approved fields/assets from the B4 published `SiteRenderContext`; it must omit a missing field rather than substitute copy, a fact, stock-child imagery, or a generic-template section. The existing `obhisSchool` demo record is explicitly prohibited as a content source.

## 1. Discovery outcome

### Audience and primary journeys

| Audience | Intent | Successful outcome |
| --- | --- | --- |
| Prospective parent/guardian | Assess fit, age/stage, environment, and next step | Reaches the current admissions surface or a school-approved visit/contact route with confidence. |
| Parent/guardian comparing programmes | Understand the appropriate entry point | Sees only currently approved programme records and proceeds to Admissions or Apply. |
| Parent/guardian who needs reassurance | See credible evidence rather than marketing claims | Views approved people/place/process material and can plan a visit. |
| Current family | Find a permitted operational route | Uses a conditional portal link or Contact route; it does not enter an admissions funnel by accident. |

### Experience character

**Rooted growth, confident care.** The site is a calm, editorial school experience: deep evergreen structure, warm paper-like space, restrained clay/gold highlights, and generous photography. It should feel local and human rather than like a SaaS template or a digitized brochure.

- Use evidence, calm explanation, and clear next steps instead of “best,” “world-class,” “expert,” safety, health, accreditation, outcome, or capacity superlatives.
- Use green as an original, cautious response to the source-observed logo—not a traced brand system. Final brand colors require the OBHIS pack and contrast validation.
- Show genuine progression through approved programme records, never imply an uninterrupted creche-to-secondary offer where it is not current.
- No platform name, platform logo, `SchoolOS`, or internal implementation language is visible on the school site without express OBHIS approval.

### Design assumptions that need no content approval

- A prospective-family primary action is labelled **“Start an application”** and calls the typed `application` link intent.
- A lower-friction secondary action is labelled **“Plan a visit”** and resolves only to an approved `visit` route/destination.
- A code-controlled, bespoke renderer has seven principal public routes and optional policy routes; it is not built from the legacy template catalogue.
- On mobile, navigation is an accessible full-height dialog; the primary action remains reachable inside the menu and in page content, rather than a persistent control that obscures reading.

## 2. Information architecture and funnel

### 2.1 Published route manifest

The following route manifest is code-controlled by `obhis-v1`. Navigation visibility may be turned off only where the entire associated approved content set is unavailable. Routes must not be created through content editing.

| Route key / path | Navigation label | Page job | Primary CTA | Required structured content before publish |
| --- | --- | --- | --- | --- |
| `home` `/` | Home | Establish approved school identity, offer a concise orientation, then lead to programme/admissions/visit paths. | `application` | `identity.displayName`, approved hero asset or non-photographic hero configuration, at least one approved next-step path. |
| `about` `/about` | About | Explain approved mission/values/history/leadership without unsupported institutional claims. | `visit` | At least one approved editorial section; leadership is optional and hidden without consented details/photo. |
| `programmes` `/programmes` | Programmes | Help a family identify active stage/programme options. | `application` or `admissions_info` | One or more current published programme records. |
| `admissions` `/admissions` | Admissions | Explain the approved high-level process and move to the product-owned admissions experience. | `application` | Approved high-level steps and a B0-resolved available `ApplicationLink`; fee/document/assessment detail stays absent until approved. |
| `school-life` `/school-life` | School life | Present rights-cleared evidence of spaces, learning, and community. | `visit` | At least one approved public asset or an approved text/illustration-led alternative. |
| `visit` `/visit` | Visit | Give current visit/contact guidance and an accessible route to make contact. | `visit` or `contact` | Approved contact method; address/hours/map only when independently approved. |
| `contact` `/contact` | Contact | Route families to current approved contact channels; provide text location/hours where approved. | `contact` | At least one current approved contact method. |
| `policy-index` `/policies` | Footer only | List approved public policy summaries/downloads. | none | One or more approved policy entries. Hidden otherwise. |
| `policy-detail` `/policies/[policySlug]` | Footer only | Provide a structured public policy summary or approved downloadable asset. | `contact` | Approved policy record and asset/summary. |
| `apply-redirect` `/apply` | Not in nav | Convenience jump to B0 canonical application surface. | redirect | B0 resolver. Return **307**, preserve only allowed attribution query values, `noindex`; never iframe/proxy a form. |

**Desktop global navigation:** `Home · About · Programmes · Admissions · School life · Visit` plus a high-emphasis **Start an application** button. `Contact` is in the utility/footer path; it may enter primary navigation only if the school chooses it and it does not crowd the primary six-item structure.
**Portal:** a `portal` intent is footer/utility-only and is hidden unless B0 resolves an enabled `PortalLink`. Label: **Family portal**. It is never styled as a prospective-admissions primary CTA.

### 2.2 Funnel and transitions

```text
Organic/search/referral
  -> Home / Programmes / Admissions
  -> approved proof (programme, environment, values) OR Visit
  -> Start an application (typed `application` intent)
  -> absolute B0 ApplicationLinkV1 on apps/apply

Existing family
  -> footer utility -> Family portal (only if enabled)
  -> canonical PortalLink

Managed domain `/apply`
  -> no-index 307 -> same absolute ApplicationLinkV1
External school site
  -> same absolute ApplicationLinkV1; no DNS delegation, iframe, or tenant-specific form link
```

Application-link behavior is fixed:

G1’s canonical `ApplicationLinkV1` entry pattern is `https://apply.<product-domain>/s/{encodeURIComponent(schoolSlug)}`. The deployed origin and final `href` are B0-owned; B5 must render the resolved `links.application.href` rather than reconstructing this illustrative pattern. This resolves G2’s earlier symbolic route example without making an OBHIS domain or renderer responsible for admissions routing.

1. B5 asks the supplied context for `links.application`; it never concatenates an origin, slug, intake, price, or return URL.
2. The CTA displays **Start an application** when `availability === "open"`; it displays a non-deceptive configured status label for `upcoming`, `paused`, or `closed` and links only where the resolver expressly permits.
3. When unavailable, hide or render an inert explanatory status chosen by the typed availability model. Do not create an `href="#"`, collect applicant data, claim a waitlist, or promise notification unless an approved route exists.
4. External navigation is announced in accessible text where helpful (for example, “Starts the secure application in a new site”); same-tab navigation is preferred unless product requirements choose otherwise. If `target="_blank"` is approved, include visible/new-window notice and safe `rel` behavior.
5. Analytics may record the semantic `application_cta_selected` event through core only; it must contain no applicant data.

## 3. Page directions

### Shared shell

- **Announcement strip:** not a promotional ticker. It is optional, one short approved operational message max, no animation, no fee/availability claims without approval. Hidden when empty.
- **Header:** 80 px desktop / 68 px mobile minimum. Text mark is a deliberate fallback until a logo asset is approved. Logo links home with an accessible name. The header becomes a solid warm-surface layer after scroll; no glass blur is required.
- **Footer:** a dark evergreen close with approved contact routes, current-year copyright only if product policy supplies it, privacy/policy links when published, and the conditional Family portal. Never invent an address, phone, social network, registration number, or company legal statement.
- **Section rhythm:** alternate quiet neutral and evergreen-pale sections; use one visual “pause” after each two content sections. No endless card grids.

### 3.1 Home `/`

| Order | Section and desktop composition | Content hierarchy / guardrail | Mobile behavior |
| --- | --- | --- | --- |
| 1 | **Editorial hero:** 12-column grid. Left 5 columns: eyebrow, H1, approved short introduction, two CTAs. Right 6 columns: 4:5 hero media with an offset 2:3 detail tile and small calm “approved school identity” label. | H1 is the approved public display name or an approved descriptor. Do not place historical contact details, fee, programme claims, or a named leader in hero. Hero can be a paper/illustration composition when no approved photo exists. | Copy first; hero media second. CTAs stack full width only under 420 px. No text over busy child photography. |
| 2 | **Orientation rail:** three large linked statements: Programmes, Admissions, Visit. | Uses approved neutral labels/descriptions; it is navigation, not proof of a service. | Horizontal scroll is prohibited; stack as generous linked rows. |
| 3 | **Programme pathway:** asymmetric 3-up/2-up cards with a numbered progression line. | Render only approved current records. Each card shows name, approved age/class descriptor, short approved summary, and “Explore programmes.” | One column; progression line becomes a left border. No inferred programme cards. |
| 4 | **Approach/values editorial band:** pull quote/statement beside supporting body and an optional approved supporting asset. | Values/mission wording requires approval. If absent, remove the section; do not use historic wording as fill. | Text then media; quote styling never creates a false attributed quote. |
| 5 | **School-life evidence mosaic:** one large landscape + two smaller panels; captions below images rather than text on photographs. | All images are approved public assets with individual alt/caption/focal point. If images are unavailable, use a designed typographic block linking to Visit/School life; no stock children. | One dominant image then two normal-flow tiles; never masonry that changes reading order. |
| 6 | **Admissions bridge:** pale-green panel with 3 approved high-level steps and `application` CTA. | No fee, documents, time estimate, guarantee, place availability, test, or interview language unless approved. Link is canonical. | Steps are numbered list, then a full-width CTA. |
| 7 | **Visit close:** warm-clay edge, clear invitation, approved visit/contact route. | The address/hours panel appears only after approval. Otherwise use a contact/visit CTA without a fake location. | Single column, no embedded map before consent/performance conditions. |

### 3.2 About `/about`

1. **Quiet page lead:** eyebrow `About`, H1 from approved content, 2–3 sentence approved positioning. Split title/body—not a large centered marketing headline.
2. **Values ledger:** 2–4 approved values in an editorial numbered list. Each has a name and concise approved explanation. Never turn the source-observed motto into a confirmed value without approval.
3. **Story/approach:** alternating text and approved image/illustration panels. Historical timeline is optional and must have documented dates/evidence.
4. **Leadership:** optional, consent-gated. Show portrait, current name/title, and approved quote only together. Omit the entire block where any component is missing.
5. **Visit bridge:** same intentional CTA close as Home.

### 3.3 Programmes `/programmes`

1. **Lead:** introductory text describes how to explore current entry points; it does not claim every stage exists.
2. **Filterless programme index:** avoid a complex filter for the expected small record count. Programme cards are large, editorial, and all clickable. Each includes: approved programme name, approved age/class range only when configured, short approved summary, optional approved image, and CTA.
3. **Programme detail bands:** one alternating panel per record (or dedicated route only if B5/B4 later agree it). The content model stays bounded: `overview`, `learningApproach`, `practicalInformation` (only approved), asset, and action. No curriculum, qualification, health, staff-ratio, transport, or timetable claims without source approval.
4. **Next step:** `admissions_info` then `application` depending on current availability.

Empty state: if no programmes are published, do not show a bare page. Use a concise approved contact/visit route, omit claims, and return `noindex` only if product policy considers this an unfinished site. B5 must not invent “enrolment open.”

### 3.4 Admissions `/admissions`

1. **Lead and trust cue:** H1 “Admissions” plus a plain-language statement that the secure application continues on a separate admissions experience. This is a cross-product boundary, not a security certification claim.
2. **High-level journey:** three to four configured, approved generic stages using ordinal labels; no step claims documents/fees/assessment by default.
3. **Entry-point cards:** render an approved programme/intake summary only when provided by the B0 resolver/content record. Use status badges with text and icon/shape, never colour alone.
4. **Questions/visit split:** card pair: “Explore programmes” and “Plan a visit”; contact data is conditional.
5. **Application close:** dark evergreen pane with canonical `application` CTA and plain cross-site disclosure. It must not be an embedded checkout or data-collection form.

Loading/unavailable state: preserve the admissions explanation and Visit/Contact path; replace the primary action with the resolver’s safe unavailable message. Do not cache an old price, link, or intake availability in renderer content.

### 3.5 School life `/school-life`

1. **Lead:** “School life” label and approved framing sentence.
2. **Evidence gallery:** accessible list/grid, not a lightbox-only experience. Each tile opens a dialog only when a larger approved rendition exists; the image, caption, and context remain meaningful in the base document.
3. **Facilities/experience editorial rows:** field-backed, factual labels only (for example, a named room/space after approval). Avoid blanket “safe,” “well-stocked,” “state-of-the-art,” or health-support claims.
4. **Visit prompt:** links to the approved visit path.

Gallery behavior: provide previous/next controls, close button, focus trap, focus return, keyboard Escape, visible caption, and reduced-motion transition. Do not include video autoplay or social embeds.

### 3.6 Visit `/visit` and Contact `/contact`

**Visit:** approved introductory copy, appointment/visit route, and conditionally available address/hours/directions as text. A map is a progressive enhancement loaded only after user action and consent policy; the same information must be in text.
**Contact:** purpose-routed cards (general, admissions, visit) only where approved channels exist. `tel:` and `mailto:` labels include the actual approved display content; no “we reply within…” promise without approval. A contact form is out of scope unless a later privacy/operations design introduces its own consent, spam, routing, and retention contract.

### 3.7 Policy routes

Policy routes use calm long-form reading layouts: max 720 px reading column, clear issued/review dates only when supplied, downloadable asset type/size when available, and a Contact escape path. Never paste the photographed historical parent rules or old declaration prose.

## 4. Visual system

### 4.1 Token set

These are `obhis-v1` working renderer tokens, not an approved OBHIS corporate palette. B5 may implement exact values only after contrast QA and may update only as a renderer-code design decision—not through content editing.

| Role | Token | Working value | Intended use |
| --- | --- | --- | --- |
| Ink | `--obhis-ink` | `#14231D` | Main text, icon strokes on light surfaces. |
| Evergreen | `--obhis-evergreen-900` | `#103D31` | Footer, dark CTA, deep section field, dark text treatment. |
| Leaf | `--obhis-leaf-700` | `#176C49` | Primary interactive fill where white text passes contrast. |
| Leaf pale | `--obhis-leaf-100` | `#E0EEE6` | Quiet section backgrounds and tags with dark text. |
| Clay | `--obhis-clay-700` | `#9D4C2E` | Limited warmth, data accents, non-primary emphasis. |
| Gold | `--obhis-gold-700` | `#8A5B12` | Small rules, numerals, and decorative accents; never sole status signal. |
| Paper | `--obhis-paper` | `#F7F5EF` | Default page ground. |
| Surface | `--obhis-surface` | `#FFFEFA` | Cards and navigation. |
| Mist | `--obhis-mist` | `#E9E7DE` | Borders / low-emphasis fills. |
| Muted ink | `--obhis-muted` | `#526158` | Supporting text. |
| Focus | `--obhis-focus` | `#0B6F94` | 3 px focus outline with 3 px offset. |
| Error | `--obhis-error` | `#A52A2A` | Validation/error text paired with icon and copy. |

- Verify all final foreground/background pairings at WCAG 2.2 AA: normal text >= 4.5:1, large text/UI >= 3:1. Do not use `leaf`, clay, or gold text on paper until the exact pair is tested.
- Only Ink on Paper/Surface, Paper on Evergreen, and tested white on Leaf are default text pairs. The design never requires a logo color to carry text.
- Status components use text + icon + shape; colour is supplementary.

### 4.2 Typography

| Role | Desktop | Mobile | Rules |
| --- | --- | --- | --- |
| Display | 56/60 px, 600 | 40/44 px, 600 | Optional editorial serif such as a self-hosted, licensed `Source Serif 4`; one line or controlled 2–3 lines. |
| H1 page lead | 48/54 px, 600 | 36/42 px, 600 | One H1 per route. |
| H2 | 34/40 px, 600 | 28/34 px, 600 | Use to start major sections. |
| H3 | 22/29 px, 650 | 21/28 px, 650 | Cards/rows; no all-caps headings. |
| Body | 17/28 px, 400 | 16/26 px, 400 | System/Manrope-like sans, comfortable reading measure 45–75 characters. |
| Small/meta | 14/20 px, 600 | 14/20 px, 600 | Labels, captions, status; maintain contrast. |

Use a resilient system sans stack as the initial render/fallback. Limit the final implementation to two self-hosted/subset families and needed weights; do not make Google font CSS or a third-party CDN render blocking. Editorial font use is reserved for display headings, not body copy, forms, or navigation.

### 4.3 Layout, space, elevation, motion

- **Grid:** 12 columns / 24 px gutters at >= 1200 px; 8 columns / 24 px gutters at 768–1199 px; 4 columns / 16 px gutters at 320–767 px. Main max-width 1280 px; readable copy max-width 680 px.
- **Spacing:** base 4 px; use 8, 12, 16, 24, 32, 48, 64, 88, 120 px. Standard section padding is 112 px desktop, 72 px tablet, 56 px mobile.
- **Radius:** 4 px rules/tags, 12 px controls/cards, 20 px media panels, 999 px only for concise tags. Avoid ubiquitous pills.
- **Borders/shadows:** 1 px Mist borders; subtle `0 12px 28px rgba(16,61,49,.08)` only for floating menu/dialog/media overlays. Card grouping relies on space and background more than shadow.
- **Motion:** 160 ms hover/focus opacity/translate at most; gallery dialog 200 ms fade/scale; respect `prefers-reduced-motion: reduce` by removing nonessential transitions. No parallax, auto-rotating carousel, video autoplay, count-up figures, or scroll-jacking.

### 4.4 Core components and states

| Component | Anatomy | Required states/behavior |
| --- | --- | --- |
| Primary button | Label + optional forward arrow, min 44 px target, Leaf or Evergreen fill | Default, hover, active, focus-visible, disabled/unavailable, loading only for a truly pending action. CTA labels are verbs, not “Learn more.” |
| Secondary button | Ink text + 1 px Ink border on Paper | Same states; no low-contrast ghost-only action. |
| Text link | Underline or clear persistent affordance; arrow is decorative | Hover/focus, visited styling if desired but contrast-safe; no generic “click here.” |
| Navigation item | Text, current-page indication, 44 px target | `aria-current="page"`; desktop underline/rule, mobile dialog item; keyboard focus always visible. |
| Mobile menu | Dialog, close control, nav list, CTA, conditional utility links | Trigger has expanded state; focus moves into dialog, trapped, Escape/close returns focus; body scroll managed without blocking zoom. |
| Programme card | Ordinal/label, H3, optional descriptor, body, text link | Entire card may be a single link; supports absent image and missing optional descriptor without blank UI. |
| Evidence media | `figure`, approved responsive image, caption, credit if required | Meaningful alt distinct from caption; decorative image has empty alt; dimensions/focal point reserved. |
| Status badge | Icon/shape, text label | Text describes state; never offers an unavailable application as a normal CTA. |
| Accordion FAQ (only if approved) | Native button + controlled region | Closed/open keyboard state, no auto-open, no FAQ schema for unapproved questions. |
| Empty/approval-blocked content | Plain heading, concise factual note, safe next route | Never show internal approval identifiers, historical facts, or fictional “coming soon” date. |

## 5. Responsive, accessibility, and content behavior

### Breakpoints

| Range | Behavior |
| --- | --- |
| 320–479 px | Single content column, 16 px page inset. Buttons may stack. Hero and full-bleed media use normal document flow. |
| 480–767 px | Four-column layout; selective 2-up image/utility grouping only when each cell remains >= 140 px. |
| 768–1023 px | Eight-column layout; header moves to mobile menu before nav links compress below readable targets. Hero can use copy/media split. |
| >= 1024 px | Full 12-column editorial layouts. Header displays primary navigation and CTA. |

No normal route may horizontally scroll at 320 CSS px, hide essential content on hover, require pointer precision, or rely on device orientation. Do not use fixed-height text cards; content growth and translated copy must reflow.

### Accessibility implementation rules

- Semantic landmarks: skip link, `header`, `nav`, one `main`, `footer`; headings never selected for visual size alone.
- All controls meet a 44 × 44 CSS-px target or have equivalent spacing; keyboard focus uses the Focus token with a visible non-clipped ring.
- Mobile menu and gallery dialog satisfy accessible-dialog focus management; normal gallery cards remain usable with JavaScript unavailable.
- Images: alt describes purpose/context, not every visible detail. Child identity is not exposed in alt text. Decorative texture has `alt=""`. Keep caption, credit, rights/provenance out of alternate text unless essential to meaning.
- Text on media uses a solid/tinted backing with verified contrast; do not depend on an image darkening overlay.
- No colour-only states, no autoplay sound/motion, no flashing content, and no essential gesture.
- If media appears later, captions/transcripts are required. Maps have a text alternative. External destination disclosure is understandable to screen-reader and sighted users.
- Test zoom to 200% and 400%, browser text enlargement, keyboard-only traversal, VoiceOver/NVDA/Chrome representative flows, and reduced motion.

## 6. Renderer field manifest and content governance

B5 receives only typed values already projected as approved by B4. Field IDs below are semantic contracts, not a generic block system. D3 defines editing/publish UX; B5 does not add free-form fields, arbitrary links, HTML, CSS, scripts, routes, or component ordering.

| Field group / semantic IDs | Type / limit | Visibility rule | Approval class |
| --- | --- | --- | --- |
| `identity.displayName`, `identity.shortName`, `identity.motto`, `brand.logo`, `brand.favicon` | text / approved asset | Name is required for public render; motto and assets optional with deliberate text fallback | name/logo/motto: sensitive-public |
| `home.hero.eyebrow`, `home.hero.heading`, `home.hero.summary`, `home.hero.asset` | short text; summary <= 280 chars; asset | All optional except approved heading; use text/graphic fallback without asset | copy standard; identity/media sensitive-public |
| `about.lead`, `about.values[]`, `about.story[]`, `about.leadership` | bounded rich text / 4 values / 3 story panels / one leader | Entire subsection hidden when unavailable; leadership requires name/title/photo/consent together | values/leadership sensitive-public |
| `programmes[]` | bounded records: slug, name, descriptor, summary <= 360 chars, approved asset, status | Only published/current content supplied; empty list uses safe alternate state | programme claim sensitive-public |
| `admissions.lead`, `admissions.steps[]`, `admissions.questionsCopy` | short rich text; 3–4 steps | Must not encode fee, document, guarantee, assessment, or availability details unless separately approved | admissions sensitive-public |
| `schoolLife.lead`, `schoolLife.gallery[]`, `schoolLife.features[]` | text; approved asset refs with caption/alt/focal point | Gallery asset rights must be approved/non-expired; features omitted without factual confirmation | asset/facility sensitive-public |
| `visit.lead`, `contact.channels[]`, `contact.address`, `contact.hours`, `contact.directions`, `visit.bookingLink` | typed contact/address/hours/link intent | Omit individual unavailable values; no “placeholder” public channel | contact/location sensitive-public |
| `policies[]` | title, summary, approved file asset, issued/review date | Route and footer link hidden when empty | policy/legal sensitive-public |
| `seo.routes[routeKey]` | title <= 60 chars guidance, description 120–160 chars guidance, approved share asset | Core validates/canonicalizes; no metadata claim beyond approved visible content | SEO is publication-controlled |
| CTA fields | label from code allowlist or approved short label + typed intent | `application`, `portal`, `visit`, `contact`, `admissions_info` only | link resolution code-controlled |

**Content absence behavior:** no `undefined` headings, empty card frames, lorem ipsum, default phone/address, or stock-photo fallback. If a page’s minimum published content cannot meet its job, the profile/publish flow must keep it out of public navigation and the renderer should return the shared safe unavailable path according to B4 policy.

## 7. Media, brand, and rights direction

### Required pre-production inputs

1. Approved legal/public display name and approved public use of “OBHIS,” if any.
2. Original logo package (SVG/PDF or high-resolution transparent source), favicon/social variants, authorized use, clear-space/minimum-size rules, and final colors; do not trace the booklet logo.
3. Current campus/programme/leadership facts and written content approver.
4. Rights-cleared photo library or a commissioned shoot. The eight photographed booklet pages and their embedded children/facility imagery are **reference-only and blocked from public use**.
5. One named approval record per visible public image: file/asset ID, photographer/license, location, people-consent state, expiry/review date, allowed channels, caption, alt-text note, and focal point.

### Priority shot list

| Priority | Asset outcome | Required coverage / constraints |
| --- | --- | --- |
| P0 | Exterior/arrival hero alternatives | Current signage/context without revealing security-sensitive entrances or children’s personal data. Capture portrait and landscape crops. |
| P0 | Learning-environment editorial photos | Real spaces/materials; photograph the actual programme only when offered. Empty-space alternatives reduce reliance on child consent. |
| P0 | Family welcome / visit | Consented adult/guardian interactions; no private records/screens. |
| P1 | Learning in action | Wide/medium/detail frames across approved activities; guardian consent and child assent where appropriate. Do not identify children by name. |
| P1 | Facility evidence | Named current spaces only after approval; photograph facts, not unsupported quality claims. |
| P1 | Leadership/staff | Current name/title and portrait release; do not reuse booklet attribution without consent. |
| P2 | Social/OG crop set | Safe text-free landscape crop with no sensitive information, plus asset alternatives for text overlays. |

Photography direction: naturally lit, tactile, observational, and calm; show hands/materials/environment alongside consented people. Avoid generic stock children, posed trophy moments, isolated child cut-outs, heavy green filters, medical scenes, assessment sheets, identifiable badges, screens, or vulnerable situations. Keep original masters and optimized public derivatives separate.

## 8. SEO, privacy, and performance brief

### SEO metadata map

| Route | Title pattern (approved content required) | Description purpose | Structured data / index rule |
| --- | --- | --- | --- |
| Home | `{approved display name} | {approved concise descriptor}` | Orientation and approved value statement | `EducationalOrganization` only from approved identity/contact/URL/logo fields; canonical indexable host only. |
| About | `About | {approved display name}` | Mission/values or history only if approved | `BreadcrumbList` + organization only if factual fields approved. |
| Programmes | `Programmes | {approved display name}` | Current programme overview, no qualification/outcome claims | `BreadcrumbList`; programme schema only if product/legal review permits accurate data. |
| Admissions | `Admissions | {approved display name}` | High-level admissions journey, no price/availability claim unless current and approved | `BreadcrumbList`; no form/FAQ schema by default. |
| School life | `School life | {approved display name}` | Approved evidence/environment framing | `BreadcrumbList`. |
| Visit / Contact | `Visit us` / `Contact | {approved display name}` | Current contact/visit purpose | Approved PostalAddress/telephone/email only; no map-only content. |
| Policies | `{policy title} | {approved display name}` | Policy scope and review date only if provided | Index only approved public policy pages. |

- Canonical URL comes from active canonical domain state, never editable text. Alias hosts 308; preview, unknown, inactive, pending, suspended, and `/apply` redirect routes are no-index.
- Social share images require a separately approved, rights-cleared OG asset; no booklet photo fallback. Make every public page title and description unique after final copy approval.
- Sitemap uses only published renderer routes and publication timestamps. If an existing public site is replaced, obtain its URL inventory and create an explicit path-by-path redirect map; never blanket-redirect missing paths to Home.
- Do not publish contact/organisation structured data until each value is current and approved.

### Privacy and performance gates

- No third-party script, pixel, map, chat, font CDN, or social embed is added by renderer/content. Use only B4’s approved analytics adapter after privacy/cookie approval.
- Event vocabulary is limited to `site_page_view`, `application_cta_selected`, `portal_cta_selected`, `contact_selected`, `visit_selected`; exclude names, email/phone, application data, document data, full URLs with sensitive queries, and child data.
- Target p75 CWV: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1. Lighthouse mobile targets: Performance >= 90, Accessibility >= 95, Best Practices >= 90, SEO >= 95.
- Hero derivative target <= 250 KB; initial page image transfer <= 1 MB; explicit width/height or aspect ratio on all media; responsive AVIF/WebP derivatives and lazy-loaded below-fold gallery images.
- Keep only interaction JavaScript needed for menu, dialogs, and approved analytics. Static content is server-rendered. Defer map/social/video on explicit user action; no autoplay video.

## 9. B5 build handoff and acceptance checks

### B5 implementation contract

1. Build a compiled `obhis-v1` renderer only after B4 exposes the validated published context, route manifest, canonical links, approved asset projection, SEO primitives, analytics hooks, and safe unavailable state.
2. Treat this specification and companion mockup as the visual/layout source of truth. The HTML is a reference for Home composition and responsive hierarchy; this specification governs all route behavior and content absence rules.
3. Do not use `apps/sites/lib/site.ts` `obhisSchool`, any photographed booklet asset, or source-observed values as fixtures that can reach public output.
4. Keep visual composition/route ordering/typography/motion in reviewed code. D3-admin values can populate only the semantic field manifest above.
5. Use `links.application` / `links.portal` from the B0/B4 context. No hard-coded application host, custom tenant form, embedded payment/form, or portal authorization assumption.
6. Implement a deliberate non-photographic fallback hero and school-life alternative for the approval period. It must not claim an unavailable programme/facility.

### Pre-release check list

- [ ] Every rendered factual field and asset has an approved, non-expired source record; unresolved content is omitted.
- [ ] Desktop/tablet/mobile layouts match the documented grid, hierarchy, route purpose, and interaction states.
- [ ] Keyboard navigation, visible focus, skip link, menu/dialog focus handling, semantic heading order, alt treatment, reduced motion, zoom/reflow, contrast, and target sizes pass review.
- [ ] Canonical `ApplicationLinkV1` is used on every Apply CTA and managed `/apply` is a no-index 307; portal is conditional.
- [ ] No private/admissions data, raw storage IDs, historic fee/contacts, medical/service claims, or booklet images enter site output/analytics.
- [ ] Canonical/robots/sitemap/JSON-LD/OG fields are approved and correct for the active host; previews are no-index.
- [ ] Image/font/JS budgets and representative mobile CWV/Lighthouse targets are documented.

## 10. Open approval blockers

**Owned by OBHIS:** public/legal name; approved OBHIS shorthand; original logo/brand pack; current programmes and curriculum wording; values/mission/history; leadership consent; current contacts/address/hours; visit process; admissions intake/process/fee disclosure/document policy; portal permission; policy copy; public imagery rights/child consent; production domain and DNS owner; analytics/privacy posture.
**Owned by delivery/platform:** B0 canonical `ApplicationLinkV1`/conditional `PortalLink`; B4 approved content/asset projection and renderer registry; no-index preview/domain behavior; event adapter; accessibility/SEO/performance validation; non-photographic fallback treatment.

Until these approvals exist, this D2 material is a build-ready composition system and review artifact—not authorization to publish any historical claim.
