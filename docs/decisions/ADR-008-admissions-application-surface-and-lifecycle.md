# ADR-008: Admissions Application Surface and Lifecycle

- **Status:** Proposed — Genesis review required
- **Date:** 2026-07-22
- **Session:** `orch-20260722-114501` / G1
- **Decision owners:** Integration owner, product owner, security/privacy reviewer
- **Related architecture:** [`AdmissionsApplicationPlatformArchitecture.md`](../features/AdmissionsApplicationPlatformArchitecture.md)

## Context

The platform must support paid school applications for schools whose public websites may be platform-managed or externally hosted. A guardian may apply for siblings. Applicants are minors and the process may collect identity, photograph, family, and conditional medical data. The existing repository has shared Better Auth, a Convex backend, per-school Paystack merchant routing, canonical student/family/portal records, and `apps/sites`; it does not have a staged admissions domain.

The existing school billing model is student-invoice based. That model cannot represent a prospective applicant without prematurely creating a student. The current public sites are hostname-resolved renderers; tying the application to them would prevent a stable external-site link and couple private workflow/auth behavior to a marketing renderer.

## Decision

### 1. Dedicated public application surface

Create a dedicated `apps/apply` surface in this monorepo. The stable link is an absolute product-owned URL:

- `https://apply.<product-domain>/s/{schoolSlug}`
- optional intake campaign: `/s/{schoolSlug}/i/{intakeSlug}`

Managed sites may link or redirect to it. External sites copy the same URL. The admissions API resolves an explicit school slug/intake slug; it does not infer authorization from the source website hostname or require source-domain cookies.

The shared `ApplicationLinkV1` value is:

```ts
type ApplicationLinkV1 = {
  version: "1";
  schoolSlug: string;
  href: string;
  availability: "open" | "upcoming" | "paused" | "closed" | "unavailable";
  intakeSlug: string | null;
  opensAt: number | null;
  closesAt: number | null;
};
```

Links contain no guardian, child, price, form version, payment reference, document, or storage identifier.

### 2. Verified guardian plus paid one-child slot

Public catalogue information is anonymous, but payment, ownership, draft, upload, and submission require an authenticated guardian with a verified contact channel. Admissions ownership uses a global guardian account keyed through a B0 server-side auth identity bridge; it does not require a pre-acceptance school `users` row.

Each verified admissions purchase creates one school-scoped entitlement. V1 products always produce exactly one slot. A guardian may legitimately purchase multiple slots for siblings.

- One verified purchase -> at most one entitlement.
- One entitlement -> exactly one durable application row.
- One entitlement -> at most one first submission.
- Reserving an entitlement and creating/getting its application are one Convex mutation.
- Creating the immutable first snapshot and consuming the entitlement are one Convex mutation.

A guardian can correct/reset the same pre-submission draft, but cannot delete it and bind the slot to a second application.

### 3. Admissions commerce is separate from tuition billing

Reuse the school's active Paystack merchant/mode, encrypted credential resolution, provider adapter patterns, and signature-verification approach. Do not create a `studentInvoice`, `billingPayment`, allocation, or student to represent an application fee.

Admissions owns product/price versions, purchase attempts, minimized provider events, payment status, and entitlements. A shared webhook dispatcher resolves a persisted non-PII reference namespace (`adm_...`) to either billing or admissions context before loading a school merchant secret.

A Paystack redirect is not payment success. Only a signature-verified webhook or server-side provider verification with matching reference, school, mode, amount, and currency may set `paid` and create/get an entitlement. Provider event ID, purchase reference, client idempotency key, and entitlement source purchase are replay keys.

### 4. Applicant remains staged; submissions are immutable revisions

Purchase and submission do not create `users`, `families`, `familyMembers`, `students`, portal access, a class placement, or an admission number.

The working application is editable only in `draft` or explicitly `changes_requested` scope. Submission creates immutable normalized snapshot header/item rows with a canonical digest, exact form/declaration/requirement/price version references, signer evidence, and revision number. Staff cannot silently edit a submitted revision. A request for changes unlocks named fields/requirements, and resubmission creates revision N+1 while retaining revision N.

Application workflow:

```text
draft -> submitted -> under_review -> changes_requested -> submitted (new revision)
submitted|under_review -> decisioned
nonterminal -> withdrawn
terminal -> archived (retention workflow)
```

Decision workflow is separate:

```text
in_evaluation -> ready_for_decision -> waitlisted|accepted|rejected
waitlisted -> in_evaluation|accepted|rejected
nonterminal -> withdrawn
accepted|rejected -> in_evaluation only by manager, as a new audited decision version
```

Document review is independent of admission decision. Each upload version moves through `uploaded -> in_review -> accepted|rejected`, with quarantine, supersession, and approved deletion paths. Document acceptance never implies applicant acceptance.

### 5. Accepted conversion is explicit and idempotent

Only an authorized conversion operator may request conversion after an accepted decision and staff-approved class, admission number, and family-resolution choice.

`admissionsConversions.applicationId` is one-to-one. The internal Convex conversion mutation validates school and state, resolves/creates the authenticated guardian's same-school parent membership and family link, resolves/creates the student user/student, applies only approved snapshot mappings, records `application_upload` photo provenance if selected, and stores every output ID with `succeeded` in the same transaction.

If the transaction throws, canonical writes roll back. An outer action records retryable/terminal failure separately and recovers stale leases. A replay after commit returns the recorded IDs. Portal onboarding and notifications are a deduplicated post-commit outbox operation, so communication failure never causes reconversion.

### 6. High-risk data is optional/minimized and least-privilege

Required defaults are limited to child identity needed for the application, DOB/entry context, accountable guardian/contact, and declaration. Photo, birth certificate, prior report, address, previous school, gender, nationality, and sibling details are optional/configurable according to purpose.

Medical/allergy information, doctor's reports, blood group, genotype, religion, disability/support data, NIN, and passport data are disabled and optional by default. Government identifiers require documented lawful purpose and owner/legal/privacy approval. Medical collection is conditional and limited to safety/accommodation need. AI extraction, matching, anomaly scoring, and automated decisioning are disabled roadmap items.

Private files use checked upload binding and on-demand signed access. Raw storage IDs and private previews are absent from public/list routes. Staff view/download is separately granted and audited. Platform support has no default application or document access.

## Alternatives considered

### A. Per-site forms inside each managed school website — rejected

**Benefits:** visually seamless; no cross-app navigation.
**Rejected because:** external schools would need another implementation; forms would couple private auth/payment/storage lifecycle to `apps/sites`; bespoke renderers could drift; security and lifecycle tests would multiply; a source-domain cookie cannot be assumed. Managed sites can still present branded admissions content and link to the canonical surface.

### B. Anonymous-only form with email links — rejected

**Benefits:** lower signup friction.
**Rejected because:** paid-slot ownership, sibling dashboards, resumable drafts, private document access, contact verification, change requests, and replay-safe support become weaker. Bearer email links are unsuitable as the only control for minors' sensitive records. Anonymous public browsing remains allowed; private workflow requires authenticated verified ownership.

### C. Create a canonical student when payment succeeds — rejected

**Benefits:** could reuse student billing/portal tables immediately.
**Rejected because:** payment proves only a purchased application opportunity, not admission; it pollutes rosters, classes, reports, billing and portal access; refunds and abandoned drafts become dangerous cleanup; it violates the staged-applicant requirement.

### D. Create a canonical student on form submission — rejected

**Benefits:** earlier reuse of family/student review screens.
**Rejected because:** submission is not acceptance; rejected/waitlisted/withdrawn applicants would become students; sensitive application fields would leak into broader canonical surfaces; retries could duplicate identities; class/admission number may not be approved.

### E. Reuse tuition invoices/payment attempts for application fees — rejected

**Benefits:** fewer tables and immediate Paystack integration.
**Rejected because:** `studentInvoices` requires a canonical student/class/session/term and models allocation against school fees. Admissions purchases produce entitlements, not invoice balances. Merchant routing and verification mechanics are reusable; invoice semantics are not.

### F. One repository/deployment per school — rejected

**Benefits:** apparent tenant separation and custom branding freedom.
**Rejected because:** it fragments security fixes, schema, payment/webhook operations, identity and integration. The confirmed architecture is one monorepo, shared Convex backend, explicit `schoolId` boundaries, and bespoke renderers where needed.

## Consequences

### Positive

- One stable application contract works from any website.
- Guardian sibling applications are first-class without duplicate account creation.
- Payment webhook replay cannot duplicate entitlements.
- Applicants remain out of canonical student/portal workflows until accepted.
- Immutable submission revisions and conversion provenance support disputes, audit, and retries.
- Sensitive files have a dedicated permission, access-audit, and retention boundary.
- Existing Paystack merchant investment is reused without distorting tuition records.

### Costs and complexity

- A new app, bounded domain, schema set, permission model, webhook dispatch path, and cross-app test suite are required.
- B0 must reconcile the current auth key/multi-school membership inconsistency before B1.
- Product owners must approve price/refund, required documents, reviewer roles, decision/reopen rules, admission-number/class placement, and retention windows.
- Conversion must stop on ambiguous same-school guardian/family/student identity rather than guessing.
- Application photo reuse requires provenance and retention reference holds.

### Security/privacy consequences

- Every school-owned row and object lookup is school-scoped.
- Actor identity is server-derived; caller user IDs do not authorize access.
- Broad school admin status does not automatically imply medical/identity document download.
- Platform admin/support is default-deny with only approved time-bound, reasoned, audited break-glass access.
- No high-risk field becomes required because it appeared in the historical OBHIS paper booklet.

## Rollback and migration notes

### Before production data

`apps/apply` and school application links are feature-flagged per school/intake. Rollback disables the offering/link and webhook dispatch for new admissions references while preserving records and allowing verified in-flight payments to reconcile. Do not delete paid entitlements or submitted applications during rollback.

### Additive schema migration

B0 changes are additive. Existing schools, users, students, billing rows, and public sites remain valid. New canonical student provenance fields are optional. No destructive backfill is required to launch admissions. Generated Convex API/types are regenerated, not hand-edited.

The auth identity bridge may require an audited backfill/alias table from legacy `users.authId` values to canonical token identifiers. It must support zero-to-many school memberships and run in observe/dual-read mode before enforcing a new key. A rollback retains aliases and restores the previous reader; it must not rewrite applicant ownership blindly.

The new admission-number index should first audit same-school duplicates. Any conflict blocks index-dependent conversion behavior for that school until resolved; do not auto-merge students.

### Payment rollback

Admissions uses a distinct reference namespace and records. The shared webhook route must continue recognizing already-issued admissions references even if new checkout is disabled. Duplicate events remain acknowledged after replaying stored outcomes. Paid but unused slots remain visible/refundable according to approved policy.

### Data rollback/export

Submitted snapshots, payment evidence, audit, decisions, and successful conversion ledgers are not destructively rolled back. If the UI is withdrawn, authorized operators require an export/read-only support path and a documented retention process. Successful canonical conversion is corrected through explicit canonical operations and audit, never by deleting the conversion ledger.

## Foundation dependencies

### Exact B0 contract

1. Server-derived `AuthIdentityV1` using canonical `tokenIdentifier`, a Better Auth user-ID bridge, and zero-to-many school memberships.
2. `ApplicationLinkV1` exactly as defined above, using explicit school/intake slugs and an absolute apply origin.
3. `PaymentReferenceV1` with `adm_` namespace, persisted school/provider/mode/domain, generalized Paystack initialization metadata, and shared invoice/admissions webhook dispatch.
4. Additive admissions tables/validators/indexes and explicit permissions from the architecture; no generated-file hand edits.
5. `students.by_school_id_and_admission_number`, application-origin uniqueness, and photo provenance/retention-hold compatibility.
6. Compatibility, tenant-isolation, canonical-link, and payment-dispatch contract tests.

### Exact D1 contract

Design every lifecycle state and recovery action without changing the state machine: verified auth, pending/paid/failed/manual-review payment, sibling slots, draft/resume/conflict, private upload, declaration, immutable submit, changes requested/resubmit revision, withdrawal, review, waitlist/accept/reject, conversion pending/success/failure, and onboarding retry. Use the fixed route/link contract and field-risk policy.

### Exact D3 contract

Design typed draft/publish/retire settings for programmes, intakes, products/prices, form fields, document requirements, and declarations. Preserve published versions. Use separate permissions for basic/sensitive view, document review/download, decision, conversion, audit, retention, and grants. Never offer arbitrary HTML/JS/layout or any setting that mutates submitted snapshots.

## Unresolved approvals

- Application price/currency, refund policy, payment methods, accidental duplicate payment process, and quantity policy.
- Required/conditional documents and size/type limits.
- Email-only versus email-plus-phone verification.
- Reviewer, decision-maker, conversion, privacy, and break-glass roles.
- Assessment/interview, waitlist, appeal/reopen, capacity, decision-copy, admission-number, and class-placement policy.
- Additional guardian conversion/invitation behavior.
- Retention/deletion windows, notices, legal holds, and jurisdictional basis.
- Every OBHIS-specific factual claim, contact, fee, policy/declaration, sensitive field, required document, and image right.

## Review gate

This ADR is accepted only when the integration owner and product/security/privacy reviewers approve the decision and record the unresolved business approvals. B0 must land before the admissions worktree begins runtime implementation.
