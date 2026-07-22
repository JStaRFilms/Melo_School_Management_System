# Design Milestone Review — D1–D3

**Session:** `orch-20260722-114501`
**Review scope:** One cross-bundle milestone review of the completed D1–D3 design artifacts against the Genesis architecture, ADRs, handoff guide, and master plan.
**Review date:** 2026-07-22
**Verdict:** **B0 may begin.** B0 is limited to the shared contract/foundation slice. The foundation merge remains blocked until the required B0 decisions and contract tests below are resolved; B1–B5 must not build against provisional alternatives.

## Review matrix

| Gate | Evidence reviewed | Result | Required disposition |
| --- | --- | --- | --- |
| `ApplicationLinkV1` | G1 defines the public DTO and `/s/{schoolSlug}` route; D1 uses those routes; D2 explicitly consumes `links.application.href`; D3 stores typed intent rather than an origin. | **Conditional pass** | B0 must make the G1 DTO the sole public `ApplicationLinkV1`. G2's earlier `canonicalUrl`/`schoolId` shape may exist only as an internal resolver context or must be retired; it must not become a competing public contract. |
| Guardian slots and payment truth | D1 covers verified identity, one paid slot per child, sibling slots, pending/paid/failed/expired/manual-review/refund/reversal, replay-safe resume, and no place/admission promise. | **Pass with contract decision** | Preserve `slotCount = 1`, server-resolved price/disclosure, provider verification before entitlement, and no quantity control in v1. |
| Application/status journey | D1 covers draft, save conflict, submit, immutable revisions, requested changes, resubmit, withdrawal, archive, decision, conversion, and onboarding retry. | **Conditional pass** | Resolve the waitlist mapping: G1 says application `decisioned` corresponds to accepted/rejected, while D1 shows `decisioned + waitlisted`. B0 must freeze whether waitlist leaves the application `under_review` or changes the application state, with one validator/state projection used by B1–B3. |
| Sensitive documents | G1 requires private binding, checked short-lived access, separate review/download grants, audit, quarantine, and no raw storage IDs; D1 preserves these boundaries in guardian and staff flows. | **Pass** | B0 must define the access-result DTO, audit-before-access ordering, fresh-auth assurance input, and non-enumerating denial behavior. List/detail contracts must remain metadata-only until explicit access. |
| Review, decision, and conversion boundaries | D1 separates completeness, document review, evaluation, recommendation, decision, conversion, and onboarding. Conversion requires accepted state, class/admission number/family resolution, idempotent ledger reuse, and limited field/photo mapping. | **Pass** | Keep accepted ≠ converted and converted ≠ onboarding delivered. No generic sensitive-data copy or automatic identity merge. |
| Content/admin permissions | D3 supplies scoped capability names, denial UX, audit requirements, approval evidence, break-glass constraints, and separate settings versus applicant-operation access. | **Conditional pass** | B0 must publish one canonical permission vocabulary and clarify that privacy/legal approval is independent evidence, not a requirement that one actor hold both publisher and approver capabilities. Resolve grant delegation, expiry, scope, and self-escalation rules. |
| Published revisions and rollback | G2 and D3 require public reads from an immutable published pointer, optimistic draft saves, validated publish, and revert-by-clone. Admissions form/price/requirement/declaration versions are likewise immutable. | **Pass** | B0 must freeze revision identity, pointer update, approval reference, compatibility/version, and audit contracts. No “latest” public read and no mutation of historical site or submission revisions. |
| No page builder | G2/D2/D3 consistently keep routes, renderer selection, component placement, typography implementation, CSS/JS, scripts, and deployment code-controlled. Typed semantic fields and intents are the only school-editable inputs. | **Pass** | Do not introduce generic blocks, arbitrary HTML, remote module paths, layout order controls, script fields, or editable application origins in B0/B3/B4. |
| OBHIS facts and assets | The brief, D2 specification, approval sheet, and mockup consistently treat booklet facts as unverified; current demo `obhisSchool` data and booklet imagery are prohibited. Approval status/evidence/expiry and omission behavior are explicit. | **Pass for design; release gated** | B5 may use only approved, non-expired published projections. Identity, programmes, admissions copy, contacts, domain, logo, imagery/consent, policies, and sensitive claims remain external release gates. |
| B0 → B1–B5 dependency contract | D1 hands B2/B3 routes/components/states; D2 hands B5 route/field/visual contracts; D3 hands B0/B3/B4 permissions and publication controls. Master-plan ownership and merge order remain intact. | **Conditional pass** | B0 must land shared names, validators, schema/indexes, permission projection, link resolver, and migration tests before either worktree consumes them. Shared schema/generated files remain integration-owner only. |
| Accessibility and security | All three specifications target WCAG 2.2 AA, keyboard/focus/reflow/reduced-motion behavior, redacted UI, tenant isolation, noindex/private views, and least privilege. | **Specification pass; implementation evidence pending** | HTML mockups are illustrative, not compliance proof. B2–B5 must implement focus trapping/restoration, Escape behavior, semantic tables/dialogs, contrast/zoom/reflow, private caching/noindex, log redaction, and security tests. |

## Release-blocking items

These do not prevent the B0 contract-freeze work from starting, but they block the named merge/release boundary.

### Before B0 foundation merge

1. **Freeze one public link contract.** Use the G1 `ApplicationLinkV1` fields (`version`, `schoolSlug`, absolute `href`, availability, nullable intake/open/close values) and canonical `/s/{schoolSlug}` route. If an internal resolver needs `schoolId`, `kind`, or `canonicalUrl`, give it a distinct non-public type.
2. **Resolve waitlist/application-state semantics.** Remove the current G1/D1 ambiguity and test every application/decision combination and legal transition.
3. **Freeze capability and approval semantics.** Reconcile G1 operational permissions with D3 site/catalogue/privacy capabilities; define programme/intake scope, expiry, delegation, revocation, default deny, break-glass, and independent approval evidence.
4. **Freeze checked document access.** Specify authorization, fresh re-auth assurance, audit-before-URL/stream ordering, URL lifetime/non-persistence, quarantine behavior, and safe return projection.
5. **Freeze immutable publication primitives.** Define draft concurrency, immutable published revision creation, public pointer update, approval/evidence expiry, asset projection, renderer schema compatibility, and revert-by-clone.
6. **Land the Genesis foundation risks with tests.** Auth identity/multi-school membership bridge, `adm_` payment dispatch and replay, school-scoped admissions tables/indexes, admission-number uniqueness audit, application/photo provenance, and compatibility with existing records must be green.
7. **Resolve the site CTA intent enum.** D2 includes `admissions_info`; D3's field registry includes `reviewed_external` but omits `admissions_info`, while the mockup exposes a smaller set. B0 must define one typed intent union and validation/ownership rules; external URLs must never become application or redirect origins.
8. **Classify public identity consistently.** D2 treats OBHIS display name/brand as approval-gated sensitive-public content, while D3's generic registry describes display-name publication as standard with school confirmation. B0 must encode an explicit approval class/policy override so a school identity cannot bypass the OBHIS launch gate.

### Before B1–B5 or production release, as applicable

- B1/B3: tenant authorization, entitlement/payment replay, immutable snapshot, document access, decision authority, conversion idempotency, grants, audit, and retention tests must pass.
- B2: managed/external link parity, truthful payment return, sibling slot separation, save conflict, upload retry, request-change/resubmit, private caching/noindex, and keyboard/mobile E2E must pass.
- B4: public-only published projection, preview isolation, asset approval, renderer fail-closed behavior, domain/TLS/canonical rules, `/apply` 307, SEO, and no arbitrary executable content must pass.
- B5: every OBHIS fact and asset must have current approval evidence; legacy/demo facts and all booklet images remain excluded. A non-photographic/text-safe launch is permitted only with an explicit school approval and all minimum route/content gates satisfied.
- B6/release: cross-host application-link parity, verified payment webhook/replay, private-file access, conversion/onboarding recovery, tenant isolation, security headers/log redaction, accessibility, and final OBHIS/domain approvals must pass.

## Deferred, non-blocking items

- Final OBHIS production copy, brand palette/logo files, photography, programme details, contact channels, policy text, portal visibility, domain/DNS choice, and analytics consent posture. These may remain absent during B0–B4 and non-public B5 development.
- Final fee amount/currency/refund language, phone-verification policy, assessment/interview/waitlist/appeal copy, retention windows, and decision communication wording. Contracts must support approved versions without hard-coding a value now.
- Optional policies route, shareable preview tokens, advanced external reviewed links, maps, video, social embeds, and analytics provider activation.
- AI/OCR/document matching, automated anomaly scoring, automated decisioning, checkout quantity greater than one, arbitrary form execution, and page-builder capabilities remain explicit non-goals rather than backlog prerequisites.
- Mockup-only interaction gaps: D2's `<details>` mobile menu and D3's illustrative modal/drawer do not yet demonstrate the specified focus trap, focus restoration, Escape behavior, or production dependency policy. Builders must follow the written accessibility/security contracts, not copy those mechanisms literally.

## Required B0 contract decisions

| Decision | Required output | Downstream consumers |
| --- | --- | --- |
| Auth identity | `AuthIdentityV1` keyed server-side by canonical token identifier; Better Auth bridge; zero-to-many active school memberships; compatibility/backfill mode. | B1, B2, B3 |
| Public application link | Exact G1 `ApplicationLinkV1`, configured apply origin, `/s/{schoolSlug}` and optional intake route, availability rules, safe unavailable response, attribution allowlist. | B2, B4, B5, external onboarding |
| Workflow projection | Canonical application, decision, entitlement, payment, document, conversion, and communication enums/transitions, including waitlist projection and safe user/staff statuses. | B1, B2, B3 |
| Payment dispatch | `PaymentReferenceV1`, `adm_` namespace, persisted school/provider/mode/domain, shared billing/admissions webhook dispatch, replay keys, minimized event contract. | B1, B6 |
| Permissions and assurance | One capability union; scoped grants, delegation/revocation/expiry, independent approval evidence, default-deny support, break-glass, and fresh-auth assurance contract. | B1, B3, B4 |
| Document access | Opaque key contract, metadata-only list DTO, checked access mutation, audit ordering, temporary URL/stream projection, quarantine and no-storage-ID rules. | B1, B2, B3, B6 |
| Site publication | Site mode/profile, domain lifecycle, immutable revisions/pointers, renderer descriptor/schema version, field manifest, approval/evidence expiry, asset rights projection, preview/noindex, revert-by-clone. | B4, B5 |
| Typed site intents | Canonical union covering internal admissions info, application, portal, contact, visit, and separately reviewed external links; no editable origins or open redirects. | B3, B4, B5 |
| Admissions versioning | Programme/intake/product/price/form/requirement/declaration validators, immutable publication, `slotCount = 1`, sensitive metadata/approval, and submitted-snapshot isolation. | B1, B2, B3 |
| Conversion compatibility | Admission-number index/audit, application-origin uniqueness, photo provenance and retention hold, explicit same-school family resolution, idempotent conversion ledger/output. | B1, B3, B6 |
| Ownership and migration | Integration owner controls shared schema, manifests, generated files, and compatibility tests; B1/B4 own behavior behind frozen boundaries; existing schools remain valid without site/admissions records. | All build packets |

## Dependency handoff

- **B0 reads first:** G1 architecture §19, both ADR required-contract sections, G2 architecture §§3–6 and 9, D3 §§3–5 and 9, then the release-blocking list in this review.
- **B1** starts only from merged B0 auth/payment/schema/permission/conversion contracts.
- **B2/B3** consume D1 after B1 APIs exist; B3 also consumes D3's settings and grant boundaries.
- **B4** consumes B0 site/link/publication contracts and D3; it must precede B5.
- **B5** consumes B4 plus D2 and the approval sheet; it cannot source facts from the current OBHIS demo record.
- **B6** owns cross-feature reconciliation and final security/accessibility/release evidence.

## Final verdict

**B0 may begin.** This is permission to execute the shared contract-and-foundation phase, not permission to merge an unresolved foundation or launch B1–B5 in parallel against draft contracts. The eight “Before B0 foundation merge” items are mandatory closure criteria.
