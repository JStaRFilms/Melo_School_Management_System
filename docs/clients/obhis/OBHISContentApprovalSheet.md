# OBHIS Public Content Approval Sheet

**Status:** D2 approval-control artifact; no row is approved merely because it appears here.
**Applies to:** `obhis-v1` website content, public SEO, public assets, and website CTA labels.
**Design specification:** `OBHISWebsiteDesignSpecification.md`
**Evidence brief:** `OBHISPublicWebsiteBrief.md`

## How to use this sheet

An authorized OBHIS owner must approve the exact publishable value/asset—not a general statement that the photographed booklet is acceptable. The content editor records a proposed value; a designated publisher/delivery reviewer checks evidence and expiry; B4 only projects approved, non-expired values into a publishable revision. Sensitive-public fields require the explicit evidence column before publish.

**Status vocabulary:**

| Status | Meaning | Public renderer behavior |
| --- | --- | --- |
| `source-observed` | Visible in the historical booklet or source but not current/approved. | Never publish. |
| `proposed` | New copy/asset supplied for review. | Never publish. |
| `pending-evidence` | Owner intends to use it but required proof/consent/current check is incomplete. | Never publish. |
| `approved` | Exact value/asset, approver, date, evidence, usage scope, and expiry/review date are recorded. | Eligible for validated published revision. |
| `rejected` | Not authorized, inaccurate, expired, or out of scope. | Omit and retain audit history. |
| `expired` | Previous approval requires refresh. | Automatically omit from a new/revised publication. |

### Required approval record fields (for every publishable item)

`field/asset ID` · exact public value or asset ID · source/evidence URI or controlled reference · owner/approver name and role · approval date · review/expiry date · permitted channels (website, OG/social, paid promotion, print) · privacy/consent classification · notes/change reason.

A reviewer must verify exact spelling, format, supported claim scope, and the audience-visible label. A general “website approved” response is insufficient for contacts, fees, legal/policy language, medical/safety claims, programme claims, images of children, and public structured data.

## Source-of-truth matrix

### A. Identity, brand, and editorial copy

| Public field / B5 semantic ID | Historical/source input (not approved) | Status at D2 | Exact approval/evidence needed | Accountable owner | Publication rule |
| --- | --- | --- | --- | --- | --- |
| `identity.displayName` | “Olive Blessed Crest Academy” appears in booklet | `source-observed` | Exact legal entity/public display name, capitalization, and approval to publish | OBHIS authorized owner | **Launch blocker** for named site. |
| `identity.shortName` | “OBHIS” is project/folder shorthand; not explained by booklet name | `source-observed` | Whether it is approved public shorthand and its intended display; otherwise omit | OBHIS | Omit until approved. |
| `brand.logo`, `brand.favicon` | Logo/motto visible only in photographed booklet | `pending-evidence` | Original vector/high-resolution file; ownership; permitted use; approved variants, clear space, colors, mono/favicon version | OBHIS + delivery | **Launch blocker for branded logo**; text-only launch needs written exception. |
| `identity.motto` / values | “INTEGRITY & SERVICE” and peace/unity line visible | `source-observed` | Current official wording, meaning/context, faith-positioning decision, exact approved copy | OBHIS leadership | Do not treat as a current value until approved. |
| `home.hero.*`, `about.lead` | Welcome/vision/mission text appears in booklet | `source-observed` | Current approved edited copy, source owner, review date | OBHIS leadership | Omit if no approved copy; do not paraphrase historical statements as fact. |
| `about.story[]` | No verified history/timeline evidence supplied | `pending-evidence` | Dated, documentary history and approved narrative | OBHIS | Omit timeline rather than infer founding/legacy. |
| `about.leadership` | Historic named administrator and welcome attribution | `source-observed` | Current legal/preferred name, title, approved quote, portrait release, publication consent | Named person + OBHIS | Omit full module if any item is absent. |
| Registration/statutory claim | Booklet appears to show `RC No. 1904768` | `source-observed` | Exact entity/number, legal confirmation, reason/permission to publish; no accreditation implication | OBHIS/legal | Omit unless specifically approved. |

### B. Programmes, operations, admissions, and policies

| Public field / topic | Historical/source input (not approved) | Status at D2 | Exact approval/evidence needed | Accountable owner | Publication rule |
| --- | --- | --- | --- | --- | --- |
| `programmes[]` early years | Creche, pre-nursery, nursery names listed | `source-observed` | Current name, age/class range, availability, hours, approved summary, intake state | OBHIS academics/admissions | No programme card/listing until current record is approved. |
| `programmes[]` primary | Primary School listed | `source-observed` | Current class range, approved learning/curriculum wording and evidence | OBHIS academics | Omit unsupported current offer. |
| `programmes[]` secondary | Secondary School listed | `source-observed` | Current year range, approved subjects/curriculum wording; evidence for any exam/accreditation statement | OBHIS academics | Omit unsupported current offer. |
| Extended care | After School Care / Summer School listed | `source-observed` | Whether currently operating; eligible ages, schedule/season, booking/fee owner | OBHIS operations | Omit until approved. |
| Day care / babysitter / nanny | Day care, tailored babysitter, nanny from three months claims | `source-observed` | Current service boundary, setting, safeguarding, staffing, licensing/insurance, approved language and legal review | OBHIS + safeguarding/legal | **High-risk; never publish from booklet.** |
| Medical/dental/eye/nutrition claims | Assistance/consultation claims in booklet | `source-observed` | Qualified provider/service evidence, exact scope, emergency/consent policy, legal/clinical review | OBHIS + legal/clinical | **Do not publish absent explicit evidence.** |
| Facility claims | “Well stocked facilities” and booklet images | `source-observed` | Current named facilities, evidence/photo, factual approved description | OBHIS + delivery | No quality/safety superlative; omit unsupported facilities. |
| Admissions steps | Vacancy, form, checklist, exam/interview/recommendation appear historically | `source-observed` | Current approved high-level steps, actual application availability, current assessment/visit process | OBHIS admissions | The site may only show generic approved steps; applications surface owns live requirements. |
| Fee / refund wording | Historical ₦5,000, non-refundable, deposit-slip/bank process | `source-observed` | Current product/amount/currency/effective date/refund wording and finance approval matching admissions configuration | OBHIS finance/admissions | **Never publish historical fee, bank details, or deposit-slip process.** |
| Required documents | Birth certificate, two photos, doctor’s report | `source-observed` | Necessity/purpose, required vs conditional state, privacy/retention review, live admissions configuration | OBHIS admissions/privacy | Keep on authoritative apply surface; no inference from paper form. |
| Sensitive child/family data | Blood group, genotype, religion, medical, nationality, address etc. in paper form | `source-observed` | Separate G1/D1 privacy-approved data policy, not website content | OBHIS/privacy + platform | No public claim that these are required. |
| `policies[]` | Illness, snacks/nuts, pickup, belongings, doctor/contact updates, timing rules | `source-observed` | Current signed policy, policy owner, safeguarding/health/allergy/legal review, approved public summary/download, issue/review dates | OBHIS policy owners | Do not copy or paraphrase historic policy prose. |
| `admissions.questionsCopy` | None current | `pending-evidence` | Approved contact/visit support route and language | OBHIS admissions | Do not promise response times, places, eligibility, or outcome. |

### C. Contact, location, domain, and links

| Public field / topic | Historical/source input (not approved) | Status at D2 | Exact approval/evidence needed | Accountable owner | Publication rule |
| --- | --- | --- | --- | --- | --- |
| `contact.address` | Plot 1, Policia Street, Federal Housing Estate, Nyanya, Abuja | `source-observed` | Current postal/display form, map pin, arrival/access guidance, owner approval | OBHIS operations | **Block Contact/Visit address display until confirmed.** |
| `contact.channels[]` phone | 0903 476 6352; 0915 949 8517; 0805 775 5997 | `source-observed` | Each active owner, permitted public purpose, international display format, WhatsApp consent if labelled as such, review date | OBHIS | Do not publish/use as a default. |
| `contact.channels[]` email | obhischool@gmail.com | `source-observed` | Active monitored mailbox, responsible team, use purpose, privacy/security approval | OBHIS | Do not publish until confirmed. |
| `contact.hours` / visit availability | No reliable current values | `pending-evidence` | Current days/hours/holiday exceptions, appointment requirement, visit coordinator | OBHIS operations | Omit rather than show placeholder hours. |
| `visit.bookingLink` | No approved route | `pending-evidence` | Typed approved destination, ownership, privacy and operational workflow | OBHIS + delivery | No generic form or unreviewed calendar embed. |
| Managed domain/canonical host | No production domain supplied | `pending-evidence` | Existing domain, DNS owner, mode (managed/external), canonical apex/www choice, cutover approval | OBHIS + platform ops | **Production cutover blocker**, not preview blocker. |
| `links.application` | No live link in booklet | `pending-evidence` | B0-generated `ApplicationLinkV1`, availability state and source attribution policy | Platform B0/B4 | B5 must consume resolver only; never enter a URL into content. |
| `links.portal` | No confirmed portal reference in booklet | `pending-evidence` | B0 `PortalLink`, school approval of label/visibility, enabled status | OBHIS + platform | Footer/utility only; hide otherwise. |
| External existing website link | Unknown | `pending-evidence` | External owner approval and B0 canonical URL; no DNS requirement merely to link | OBHIS + external site owner | Direct absolute ApplicationLink only; no iframe. |

### D. Visual assets, consent, and media

| Asset category / semantic ID | Historical/source input (not approved) | Status at D2 | Required evidence/metadata | Accountable owner | Publication rule |
| --- | --- | --- | --- | --- | --- |
| All eight photographed booklet pages | Files in supplied enrolment-form folder | `rejected` for public use | N/A: reference evidence only; perspective/quality/privacy and rights unsuitable | Delivery | Never publish as site content or OG art. |
| Embedded children/facility photographs | Images visible within booklet | `pending-evidence` | Original file and photographer license; identifiable-minor guardian consent, child assent where appropriate, usage/expiry/channel scope | OBHIS + photographer | **Blocked**; do not crop, trace, upscale, or reuse. |
| New hero / `home.hero.asset` | Not supplied | `pending-evidence` | Asset ID; location/photographer release; people/child consent; alt note; focal point; derivatives; allowed channels | OBHIS + delivery | Use non-photographic designed fallback if absent. |
| Gallery / `schoolLife.gallery[]` | Not supplied | `pending-evidence` | Per-asset rights/consent metadata, accurate caption, meaningful alt, focal point, expiry | OBHIS + delivery | Only approved/non-expired public assets project to renderer. |
| Staff/leadership portraits | Historic administrator photo/consent unknown | `pending-evidence` | Current role/name, portrait release, person’s consent, review date | Person + OBHIS | Omit if person or consent changes/expires. |
| Social share image | No approved asset | `pending-evidence` | Separate rights-cleared landscape asset; text-safe crop; permitted social/advertising scope | OBHIS + delivery | Do not fall back to booklet/child photograph. |
| Alt text / captions | Not supplied | `pending-evidence` | Intent-specific alt, caption/credit if appropriate, non-identifying child treatment | Delivery reviewed by OBHIS | Renderer cannot expose an image without alt/decorative state. |

## Items that must never be inferred

The following are prohibited from site copy, metadata, structured data, CTA labels, image captions, schema, or demo-to-production migration unless an independently approved current record exists:

- fee, non-refundability, bank account/payment method, application availability, capacity, admissions timeline, assessment/interview, document requirements, placement guarantee, response time;
- current phone/email/address/office hours, WhatsApp availability, map pin, domain, registrar, DNS/host, or portal availability;
- programme/class/year availability, curriculum/exam body/accreditation, staff certification, health/medical/nurse/dental/eye/nutrition services, safety/quality/outcome claims, childcare/nanny/babysitter service;
- registration number/accreditation/legal status, history/founding date, leadership identity/title/quote, motto/faith position;
- policy/legal/declaration wording, privacy/legal compliance promise, or cookie policy;
- facts/images copied from the legacy `obhisSchool` demo record, including “Obhis Heritage Academy,” Enugu address, `.example` emails, or demo phone numbers;
- all booklet photography and the identity/names of pictured children.

## Release approval ledger (complete before production publication)

| Gate | Required approver(s) | Evidence checked | Status / date |
| --- | --- | --- | --- |
| Identity/brand pack | OBHIS authorized owner | Exact public name, shorthand decision, original logo rights/variants | `pending` |
| Programmes and editorial copy | OBHIS academic/leadership owner | Each programme record, values/mission/story copy, leadership consent | `pending` |
| Admissions and CTA availability | OBHIS admissions/finance + platform | Current public process copy; B0 resolved application link; fee/content decision | `pending` |
| Contacts/visit | OBHIS operations | Each channel/address/hours/booking route current and monitored | `pending` |
| Policies/sensitive claims | OBHIS policy/legal/safeguarding owner | Signed current policy/claim scope and review dates | `pending` |
| Images and rights | OBHIS + photographer/delivery | Per-asset license/consent/expiry/alt/caption/focal point | `pending` |
| Privacy/analytics | OBHIS privacy owner + platform | Analytics adapter/consent posture/privacy notice and event data minimization | `pending` |
| Domain/SEO cutover | OBHIS DNS owner + platform ops | TXT ownership, routing, TLS, canonical host, redirect inventory, approved metadata | `pending` |
| Design/a11y/performance | Delivery + OBHIS content sign-off | D2/B5 visual fidelity, responsive/a11y checks, approved asset/copy audit, performance evidence | `pending` |

## Handoff contract

- **D3:** represents source status, evidence, approver/date, expiry, sensitive-public gate, preview, rejection, publish/revert audit, and omission behavior; it must not offer arbitrary page/layout/script controls.
- **B4:** returns only the approved published projection and B0-resolved links; drafts, source-observed values, rejected/expired assets, internal evidence notes, and raw storage IDs never reach the renderer.
- **B5:** uses `OBHISWebsiteDesignSpecification.md` for composition and this sheet as the publication gate. It must show a deliberate omission/fallback—not fictional copy/media—when a listed item is not approved.
