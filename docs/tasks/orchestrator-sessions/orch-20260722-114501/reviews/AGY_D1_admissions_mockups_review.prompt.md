# Antigravity CLI — D1 Admissions Mock-up Review

You are independently reviewing the D1 admissions mock-ups. Do **not** redesign from taste alone. Judge the UI strictly as a renderer of the data and state contracts below.

Do not edit files or implement code. Inspect only the supplied workspace material and return a structured critique.

## Original D1 mission

Design accessible guardian and staff experiences for one paid application slot per child: guardian purchase/resume/submit/status journeys and staff triage/review/decision/conversion journeys. The experience must accurately represent payment, application, document, decision, and conversion states; it must never imply that a payment, submitted form, or document approval has secured admission.

## Read these sources

- `docs/mockups/admissions/guardian-journeys.html`
- `docs/mockups/admissions/staff-review-journeys.html`
- `docs/features/AdmissionsExperienceDesign.md`
- `docs/features/AdmissionsApplicationPlatformArchitecture.md`
- `docs/decisions/ADR-AdmissionsApplicationSurfaceAndLifecycle.md`
- `docs/features/DesignMilestoneReview.md`

## Data model the UI must render

### Public/application link
`ApplicationLinkV1 = { version: "1", schoolSlug, href, availability: "open" | "upcoming" | "paused" | "closed" | "unavailable", intakeSlug?: string | null, opensAt?: timestamp | null, closesAt?: timestamp | null }`.
The resolved absolute `href` is server-owned. The UI may never construct it from a hostname, trust a query parameter, or use the opaque application ID as authority.

### Guardian and payment data
- verified guardian account/contact-verification state
- published school/intake/product/price/disclosure version; unapproved OBHIS facts are never runtime defaults
- one paid entitlement/slot per child, with separate sibling slots
- payment states: `checkout_pending`, `verification_pending`, `paid`, `failed`, `expired`, `manual_attention`, `refunded`, `reversed`
- payment data may expose only a partial reference and safe status, never provider secrets or another guardian's data

### Application data
- application has an opaque public ID, school scope, owning guardian, bound slot, programme/intake/product/form/price/declaration versions, immutable submitted revisions, and a workflow state
- guardian-visible states include `draft`, `submitted`, `under_review`, `changes_requested`, decisioned accepted/rejected/waitlisted, `withdrawn`, and `archived`
- each section has `not_started | in_progress | complete | needs_attention`
- slots visibly distinguish available, draft, action needed, submitted, decision recorded, conversion in progress, converted, and unavailable/held
- a second child must use another slot; no cloning, reassignment, or shared child data

### Field/document data
- field schema is typed: key, label, kind, help, validation, required/optional mode, conditional rule, purpose, data class, visibility/audience, retention policy, and form-version
- core child/guardian data, optional background, and conditional sensitive data are separate groups
- NIN, passport, genotype, religion, blood/medical/support data and government identity documents are disabled/optional by default unless explicitly approved
- document requirement data: category, purpose, required/conditional state, MIME/size/count limits, sensitivity, version/status, review result
- no raw storage ID, signed URL, document filename, medical value, or private file preview belongs in public routes, list rows, logs, or default staff lists

### Staff/decision/conversion data
- staff capabilities are explicit and school-scoped: `applications.list`, `applications.view_basic`, `applications.view_sensitive`, `documents.review`, `documents.download`, `decisions.record`, `conversions.execute`
- list rows are redacted/bounded/paginated; sensitive content requires an explicit audited reveal, and document access is separately checked
- assessment/interview results inform but never automate a decision
- decision is distinct from conversion: `accepted` does not create a student
- conversion states are `requested`, `running`, `succeeded`, `failed_retryable`, `failed_terminal`; it maps only approved fields, may mark application photo provenance `application_upload`, and is idempotent/replay-safe

## Review criteria

Review both guardian and staff HTML for:
1. Whether every important real data/state combination has a clear truthful UI, including unavailable intake, payment delay/failure/reversal, concurrent draft, requested changes, permission denial, missing/conditional document, archived data, and conversion recovery.
2. Whether labels, hierarchy, tables/cards, empty states, validation, and mobile behavior are understandable with real long names, long labels, missing optional fields, and zero/one/many records.
3. Whether the UI leaks private/sensitive data, invents school facts/prices/documents, treats a mock value as authoritative, or lets appearance imply unauthorized action.
4. Whether accessibility is concrete: keyboard flow, focus, semantic labels, non-colour status, error association, low-bandwidth/upload recovery, and 320px reflow.
5. Whether the mock-ups are buildable from the stated typed contracts rather than static screenshots.

## Required response

Return only:
- `Verdict: ready / needs revision / blocked`
- Top 8 concrete issues, ranked by severity
- A table: `mock-up area | missing/incorrect data contract | required UI change | severity`
- Data states that must be added before B2/B3 implementation
- What is already strong and should not be discarded

Do not give generic aesthetic advice. Do not create a reviewer or make code changes.