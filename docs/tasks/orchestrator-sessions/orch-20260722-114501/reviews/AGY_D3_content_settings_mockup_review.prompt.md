# Antigravity CLI — D3 Content & Admissions Settings Mock-up Review

You are independently reviewing the D3 admin settings mock-up. Do **not** judge it as a generic CMS dashboard. Judge it as a permissioned, versioned, data-driven operating surface for public school content and admissions configuration.

Do not edit files or implement code. Inspect only the supplied workspace material and return a structured critique.

## Original D3 mission

Design bounded admin editing for school content and admissions settings without a page builder, arbitrary HTML/layout control, unsafe applicant access, or mutation of submitted application snapshots.

## Read these sources

- `docs/mockups/admin/school-content-and-admissions-settings.html`
- `docs/features/SchoolContentAndAdmissionsSettingsUX.md`
- `docs/features/AdmissionsApplicationPlatformArchitecture.md`
- `docs/features/SharedCoreBespokeSchoolWebsiteArchitecture.md`
- `docs/features/DesignMilestoneReview.md`

## Data model the UI must render

### Scope/version/audit envelope
- every record is school-scoped; permissions can be narrowed to programme/intake and may expire
- draft versions use optimistic concurrency; `DRAFT_VERSION_CONFLICT` requires refresh-and-compare, never silent last-write-wins
- public site and admissions configuration have separate immutable published versions; publishing creates a new revision, reverting clones a prior revision into a new draft
- audit entries show actor, action, target/version, result, timestamp, scope, and reason, but never applicant answers, raw files, medical values, secrets, or webhook contents

### Capabilities
The server returns explicit capabilities; hiding a button is never authorization.
- site: `settings.manage`, `site.preview`, `site.publish.standard`, `site.publish.sensitive`, `site.revert`, `site.domain.request`
- admissions: `admissions.catalogue.manage`, `admissions.publish`, `admissions.sensitive.configure`
- applicant/document operations are separate: `applications.list`, `applications.view_basic`, `applications.view_sensitive`, `documents.review`, `documents.download`, `decisions.record`, `conversions.execute`
- platform support has none of these sensitive/applicant capabilities by default; break-glass is time-bound, reasoned, scoped, and audited

### Site content data
- typed identity/contact, brand assets, approved copy, programmes, gallery, policies, CTA intents, SEO metadata, navigation visibility for existing code-owned routes, domain support state
- assets have purpose, type/size/dimensions/checksum, alt/decorative state, focal point, rights/consent status, expiry, and public/private projection
- editors cannot add components/routes, change renderer module/order, CSS/JS/HTML, analytics scripts, deployment, canonical origin, or arbitrary redirect URL
- preview is authorized/no-index/watermarked and must show only draft-safe data; public render reads immutable approved revisions only

### Admissions configuration data
- programme/intake/product/price/disclosure/form/document-requirement/declaration versions are immutable once published
- product slotCount is fixed to 1 in v1; price is integer minor units/currency/effective dates/disclosure/refund key; it never changes a paid transaction
- field schema: key, label, type/kind, help, validation, required mode, declarative conditional rule, purpose, data class, audience, retention, form-version
- sensitive/government/medical fields are disabled by default and require purpose, privacy approval, retention, access scope, and a guardian notice; they never grant applicant/document viewing rights
- document schema includes category, required/conditional state, MIME/size/count, sensitivity/purpose, retention/audience, and version
- declaration is versioned restricted rich text; optional consent is never pre-checked
- submitted applications, payment events, documents, decision/conversion ledgers, raw storage IDs, signed URLs, and applicant operations are immutable/out of this workspace

### Publication/availability/link data
- `ApplicationLinkV1` is B0-owned and resolves absolute href plus `open | upcoming | paused | closed | unavailable`; content cannot enter an application origin manually
- external URLs must use reviewed HTTPS allowlisted destinations; no `javascript:` or open redirects
- publish review must expose changed semantic fields, validation, approvals/expiry, affected routes/offering, capability, reason, and immutable-version outcome

## Review criteria

Review the HTML against realistic operational data:
1. no capabilities, expired/limited grants, break-glass request, competing editors/conflict, stale draft, validation failures, missing privacy evidence, expired child-image consent, pending DNS/TLS, unavailable application link, and rejected asset.
2. catalogue/product/form/document/declaration versions that are published, retired, paused, incomplete, or contain sensitive configuration.
3. long field labels, many programmes/intakes/assets/audit rows, mobile/table transformation, keyboard-only use, and safe empty states.
4. whether public content settings are clearly separated from admissions operations/private applicant records.
5. whether every UI control corresponds to a typed data field, capability, state transition, validator, preview rule, and publication rule—not static dashboard fiction.

## Required response

Return only:
- `Verdict: ready / needs revision / blocked`
- Top 8 concrete issues, ranked by severity
- A table: `settings area | missing/incorrect data/capability/state | required UI change | severity`
- Required B0/B3/B4 contract clarifications before implementation
- What is already strong and should not be discarded

Do not give generic aesthetic advice. Do not create a reviewer or make code changes.