# Admissions Application Platform Architecture

**Status:** Genesis decision draft for review
**Session:** `orch-20260722-114501` / G1
**Date:** 2026-07-22
**Decision record:** [`ADR-AdmissionsApplicationSurfaceAndLifecycle.md`](../decisions/ADR-AdmissionsApplicationSurfaceAndLifecycle.md)

## 1. Executive decision

Build admissions as a tenant-aware bounded context in the shared Convex deployment, with a dedicated public Next.js surface (`apps/apply`) and a stable school-slug link. A globally authenticated, verified guardian may buy multiple school-scoped application-slot entitlements. Each paid entitlement is bound atomically to exactly one durable application record and can be consumed by at most one first submission. Purchase, draft, or submission never creates a canonical student.

An accepted application is converted only through a separately authorized, idempotent, audited operation. The operation links or creates canonical `users`, `families`, `familyMembers`, and `students` records in one Convex transaction, preserves all immutable submission revisions, and queues portal onboarding only after the transaction commits.

Personal data about minors, identity documents, photographs, and medical data are high-risk. They are private, school-scoped, purpose-limited, excluded from list payloads, and available only through checked, short-lived access. Optional sensitive fields are disabled by default.

## 2. Goals, non-goals, and invariants

### Goals

- Work for a platform-managed website, an external school website, or a shared link without coupling to `apps/sites`.
- Let one verified guardian purchase legitimate sibling slots while enforcing one slot to one application and no more than one submitted child application per slot.
- Support versioned programmes, intakes, products/prices, forms, requirements, declarations, resumable drafts, immutable submissions, staff review, decisions, and conversion.
- Reuse the existing Better Auth, school boundary, Paystack merchant routing, Convex storage, and canonical school records where their semantics fit.
- Make all retries, webhook replays, concurrent reservations, and interrupted conversions deterministic.

### Non-goals

- No schema, UI, production function, manifest, or navigation implementation in G1.
- No anonymous-only application ownership.
- No tuition invoice created for an admissions fee.
- No student, family, portal membership, or admission number created at checkout or submission.
- No OCR, AI extraction, automated document authenticity decision, or automated admissions decision.
- No arbitrary form code, HTML/JS, or page-builder behavior.
- No OBHIS price, contact, policy, legal declaration, required document, or public claim is approved by this document.

### Hard invariants

1. `admissionsEntitlements.sourcePurchaseAttemptId` is unique; one verified purchase creates at most one entitlement.
2. `admissionsApplications.entitlementId` is unique; an entitlement is never rebound to a second application row.
3. Entitlement reservation and application creation occur in one mutation; first submission, snapshot creation, and entitlement consumption occur in one mutation.
4. Every application, document, review, decision, payment, conversion, and audit row that belongs to a school carries `schoolId`, and every object lookup rechecks it.
5. A submitted revision is immutable. Requested changes create a later snapshot revision; they never update a prior snapshot.
6. `admissionsConversions.applicationId` is unique. A successful replay returns the recorded canonical IDs.
7. Redirect success is not payment success. Only a provider-verified transaction can create an entitlement.
8. Signed storage URLs are generated only after authorization and are never stored as durable application data.
9. Caller-provided user IDs are never used for authorization. Identity is derived server-side.
10. Cross-school duplicate detection is forbidden. Matching and warnings are scoped to one school.

## 3. Sources inspected and baseline findings

### Supplied OBHIS source

All eight photographs at `C:/CreativeOS/01_Projects/Clients/OBHIS/Enrollment application form/` were inspected. The paper form includes a historical ₦5,000 non-refundable application fee; a birth certificate, two passport photographs, and a conditional doctor's report; class/section choice; child and family details; blood group, genotype, religion, and medical information; prior schools; a declaration; and official entrance-exam/interview/recommendation fields. The booklet also contains school claims, imagery, contacts, and policy wording.

These are **unverified source inputs**, not launch content. In particular, the historical price, non-refundability, required documents, health wording, contact details, imagery rights, and declaration require owner/legal approval. Blood group, genotype, religion, government identifiers, and health data are not default-required.

### Existing code findings

| Severity | Finding | Evidence / consequence |
| --- | --- | --- |
| High | Current generic academic auth resolves `users.authId` from `identity.subject`, while current Convex guidance requires `identity.tokenIdentifier` as the canonical auth key. | `packages/convex/functions/academic/auth.ts`; `packages/convex/_generated/ai/guidelines.md`. B0 must freeze one identity bridge and migration strategy before admissions stores ownership. |
| High | A guardian may need one login across schools, but several current helpers call `.unique()` on `users.by_auth`; the portal instead deliberately collects multiple memberships. | `packages/convex/functions/auth.ts`, `packages/convex/functions/academic/auth.ts`, and `packages/convex/functions/portal.ts`. Admissions must not require a pre-acceptance `users` row and must use a global guardian account plus school-scoped records. |
| High | The payment webhook resolver is hard-wired to student invoices and `billingPaymentAttempts`; an admissions fee cannot safely use that model without pretending an applicant is a student. | `packages/convex/functions/billingWebhooks.ts`, `billingProviders.ts`, `billing.ts`, and `packages/convex/schema.ts`. B0 must add a shared reference-dispatch contract while B1 owns admissions payment rows. |
| High | Existing storage use commonly returns signed URLs after domain authorization, but no admissions-grade document access audit exists. | `packages/convex/functions/academic/lessonKnowledgeSourceProof.ts`, `studentEnrollment.ts`, and `portal.ts`. Admissions must use a new audited access gate and never expose raw storage IDs in public routes/list results. |
| Medium | `students` has no unique `by_school_and_admission_number` index and current duplicate checks use `.filter()` after `by_school`, contrary to current Convex guidance. | `packages/convex/schema.ts` and `packages/convex/functions/academic/studentEnrollment.ts`. B0 should add the index; conversion must use it transactionally. |
| Medium | Existing student photo fields have no source/provenance marker. | `packages/convex/schema.ts` and `studentEnrollment.ts`. B0 must add an additive provenance contract or a one-to-one provenance table before application photos are linked. |
| Medium | Existing school roles are broad (`admin`, `teacher`, `parent`, `student`) and cannot express sensitive-document, decision, conversion, or privacy privileges. | `packages/convex/schema.ts` and `academic/auth.ts`. Admissions needs explicit school grants; school-admin status alone must not silently expose medical/identity documents. |
| Medium | `apps/sites` has fixed in-code school configs and ordinary `href` actions. | `apps/sites/lib/site.ts` and `apps/sites/app/[[...slug]]/page.tsx`. The admissions contract should be a normal absolute URL resolved by school slug, not a site-host-derived embedded form. |

## 4. Bounded contexts and terminology

| Context | Responsibility | Does not own |
| --- | --- | --- |
| Identity | Global guardian login, verified contact evidence, auth identifier bridge | School family membership before acceptance |
| Admissions catalogue | Programmes, intakes, versioned forms, document rules, declarations, products and prices | Public-site layout or tuition fee plans |
| Commerce | Purchase attempts, provider events, verified payment result, slot entitlement | `studentInvoices`, tuition allocations, student balances |
| Application | One child application, mutable working data, immutable submission revisions | Canonical `students` |
| Documents | Private uploads, categories, versions, checks, review status, access audit | Public media gallery |
| Review and decision | Assignment, completeness, document review, assessment/interview outcomes, recommendations, decision | Automated eligibility |
| Conversion | Exactly-once mapping to canonical family/student data and photo provenance | Portal communication transaction |
| Audit/retention | Append-only security/business events, holds, redaction and deletion jobs | Editing submitted snapshots |

**Guardian account:** the global authenticated prospective-family identity.
**Slot / entitlement:** verified proof that one application may be started and submitted.
**Application:** the durable staged record for one prospective child.
**Submission revision:** an immutable snapshot created on each submit/resubmit.
**Applicant:** never synonymous with canonical student.
**Conversion:** authorized creation/linking of canonical records after acceptance.

## 5. Reuse and ownership map

### Reuse as-is or behind a shared abstraction

- `schools` and `schools.slug` for tenant identity and stable public resolution.
- Better Auth for signup/session; Convex identity must be normalized by the B0 auth bridge.
- `schoolBillingSettings`, `schoolPaymentProviders`, and encrypted `schoolPaymentProviderSecrets` for school/mode merchant selection.
- The Paystack adapter's amount conversion, initialization, verification, and HMAC approach after generalizing invoice-specific metadata.
- Convex `_storage`, `generateUploadUrl`, `_storage` metadata checks, and on-demand `getUrl`.
- `users`, `families`, `familyMembers`, `students`, and `classes` only at accepted conversion.
- `provisionSchoolPortalAuthUser` patterns only for a post-conversion onboarding worker; do not provision inside conversion.
- Existing audit-table patterns as implementation guidance, not the `contentAuditEvents` table itself.

### Admissions owns separately

Admissions owns all proposed `admissions*` tables and `packages/convex/functions/admissions/**`. It must not reuse `feePlans`, `studentInvoices`, `billingPayments`, `billingPaymentAttempts`, `paymentAllocations`, or invoice-specific event rows for admissions fees. The semantics, payer lifecycle, refund effects, and entitlement output differ.

## 6. Proposed data model

All timestamps are epoch milliseconds. All mutable rows include `createdAt`, `updatedAt`, and an actor where applicable. All IDs use Convex `Id<"table">`; all validators are explicit. Growing collections are rows, never unbounded arrays. Index names list all indexed fields in order.

### 6.1 Catalogue, forms, and prices

| Table | Cardinality and key fields | Required indexes |
| --- | --- | --- |
| `admissionsProgrammes` | School 1:N programmes. `schoolId`, `slug`, `name`, `description`, `status: draft\|published\|closed\|archived`. | `by_school_id`; `by_school_id_and_slug`; `by_school_id_and_status` |
| `admissionsIntakes` | Programme 1:N intakes. `schoolId`, `programmeId`, `slug`, `name`, `cycleLabel`, optional `targetClassId`, `opensAt`, `closesAt`, optional `startsAt`, `status: draft\|open\|paused\|closed\|archived`. | `by_school_id`; `by_school_id_and_slug`; `by_school_id_and_status_and_opens_at`; `by_programme_id_and_status` |
| `admissionsFormVersions` | School/programme 1:N immutable published versions. `schoolId`, `programmeId`, optional `intakeId`, `version`, `schemaVersion`, `status: draft\|published\|retired`, `publishedAt`, `publishedBy`. Draft may change; published rows never change except retirement metadata. | `by_school_id_and_programme_id`; `by_intake_id_and_status`; `by_school_id_and_programme_id_and_version` |
| `admissionsFormFields` | Form version 1:N fields. `schoolId`, `formVersionId`, stable `fieldKey`, `sectionKey`, `kind`, `label`, `helpText`, `requiredMode`, `dataClass`, optional `purpose`, `order`, `validation`, `conditionalRule`, `status`. No executable expressions; conditions use a bounded declarative grammar. | `by_form_version_id_and_order`; `by_form_version_id_and_field_key`; `by_school_id_and_data_class` |
| `admissionsDocumentRequirements` | Form/intake 1:N requirements. `schoolId`, `formVersionId`, `requirementKey`, `category`, `label`, `requiredMode`, optional condition, accepted MIME types, `maxBytes`, `maxFiles`, `sensitivity`, `purpose`, `order`. | `by_form_version_id_and_order`; `by_form_version_id_and_requirement_key`; `by_school_id_and_category` |
| `admissionsDeclarationVersions` | School/programme 1:N immutable declarations/consents. `schoolId`, `programmeId`, `version`, `title`, `body`, `purpose`, `status`, `publishedAt`, `publishedBy`. Separate checkboxes are separate rows or declaration items, not bundled consent. | `by_school_id_and_programme_id_and_version`; `by_programme_id_and_status` |
| `admissionsProducts` | Intake 1:N purchasable application products. `schoolId`, `intakeId`, `slug`, `name`, `slotCount` fixed to `1` for v1, `status: draft\|active\|paused\|retired`. | `by_school_id_and_intake_id`; `by_school_id_and_slug`; `by_intake_id_and_status` |
| `admissionsProductPrices` | Product 1:N immutable effective prices. `schoolId`, `productId`, `version`, `amountMinor`, `currency`, `refundPolicyKey`, `feeDisclosure`, `effectiveFrom`, optional `effectiveTo`, `status`. Never use floating amounts. | `by_product_id_and_version`; `by_product_id_and_status_and_effective_from`; `by_school_id_and_status` |

Publishing resolves tenant defaults/overrides into a complete immutable form version. An application points directly to the resolved form, declaration, requirement, and price versions, so later settings cannot rewrite history.

### 6.2 Guardian, commerce, and entitlement

| Table | Cardinality and key fields | Required indexes |
| --- | --- | --- |
| `admissionsGuardians` | Global account-owned row, not school-owned. `authTokenIdentifier`, optional `betterAuthUserId`, normalized email, email verification evidence/time, optional normalized phone and verification evidence/time, `status`. | `by_auth_token_identifier`; `by_better_auth_user_id` |
| `admissionsPurchaseAttempts` | Guardian/school 1:N attempts. `schoolId`, `guardianId`, `productId`, `priceId`, provider/mode, server-generated `reference`, client `idempotencyKey`, amount/currency/fee snapshots, state, provider authorization metadata, verification timestamps, failure code, optional entitlement ID. Store only redacted/minimized provider payload. | `by_reference`; `by_school_id_and_reference`; `by_guardian_id_and_created_at`; `by_school_id_and_state_and_created_at`; `by_school_id_and_guardian_id_and_idempotency_key` |
| `admissionsPaymentEvents` | Attempt 1:N append-only provider events. `schoolId`, `purchaseAttemptId`, provider/mode, `providerEventId`, event type, body digest, selected redacted fields, signature status, processing result/time. Raw bodies, if legally/operationally required, are encrypted and short-lived; never list-returned. | `by_school_id_and_provider_and_provider_event_id`; `by_purchase_attempt_id_and_received_at`; `by_school_id_and_processing_result_and_received_at` |
| `admissionsEntitlements` | Exactly 1 per verified v1 purchase. `schoolId`, `guardianId`, `productId`, `intakeId`, `sourcePurchaseAttemptId`, state, optional `applicationId`, reserved/consumed/void timestamps and reason. | `by_source_purchase_attempt_id`; `by_guardian_id_and_state_and_created_at`; `by_school_id_and_state_and_created_at`; `by_application_id` |

The application layer enforces uniqueness by indexed `.unique()` reads inside mutations; Convex schema indexes do not themselves create SQL-style unique constraints.

### 6.3 Application working data and immutable snapshots

| Table | Cardinality and key fields | Required indexes |
| --- | --- | --- |
| `admissionsApplications` | Entitlement 1:1. `schoolId`, `guardianId`, `entitlementId`, `programmeId`, `intakeId`, `productId`, `priceId`, `formVersionId`, `declarationVersionId`, opaque `publicId`, workflow state, `currentRevision`, latest snapshot ID, requested class/entry label, lock/version timestamps, optional decision/conversion IDs. No medical details in this operational row. | `by_entitlement_id`; `by_school_id_and_public_id`; `by_guardian_id_and_updated_at`; `by_school_id_and_state_and_updated_at`; `by_school_id_and_intake_id_and_state` |
| `admissionsApplicantProfiles` | Application 1:1 typed child core. `schoolId`, `applicationId`, names, DOB, optional gender, preferred name, optional nationality/country of birth, optional address. | `by_application_id`; `by_school_id_and_normalized_name_and_date_of_birth` (warning only, never auto-merge) |
| `admissionsApplicationContacts` | Application 1:N adults/emergency contacts. `schoolId`, `applicationId`, `contactKey`, type, names, relationship, email, phone, address, `isApplicantGuardian`, `isPrimary`. | `by_application_id_and_contact_key`; `by_school_id_and_normalized_email`; `by_application_id_and_is_primary` |
| `admissionsPreviousSchools` | Application 1:N. `schoolId`, `applicationId`, name, optional start/end date and class. | `by_application_id_and_end_date`; `by_school_id_and_application_id` |
| `admissionsApplicationAnswers` | Application 1:N school-configurable answers. `schoolId`, `applicationId`, `formFieldId`, `fieldKey`, typed value union, `dataClass`, value version. Core identity/contact fields do not live here. | `by_application_id_and_field_key`; `by_form_field_id`; `by_school_id_and_data_class` |
| `admissionsSubmissionSnapshots` | Application 1:N immutable headers. `schoolId`, `applicationId`, `revision`, `formVersionId`, `declarationVersionId`, `productPriceId`, `requirementsDigest`, canonical digest, signer guardian ID/name/relationship, submittedAt, declaration acceptance evidence, client locale/version. | `by_application_id_and_revision`; `by_school_id_and_submitted_at`; `by_canonical_digest` |
| `admissionsSubmissionSnapshotItems` | Snapshot 1:N immutable normalized field/contact/previous-school/document-manifest items. `schoolId`, `snapshotId`, `itemKey`, `kind`, typed value, `dataClass`, source row/version. This avoids a 1 MB monolith. | `by_snapshot_id_and_item_key`; `by_school_id_and_data_class`; `by_snapshot_id_and_kind` |

Snapshot rows have no update API. A digest is calculated over a canonical, ordered representation. A resubmission increments `revision`, creates new header/items, and leaves all prior revisions untouched.

### 6.4 Documents, review, decisions, conversion, audit

| Table | Cardinality and key fields | Required indexes |
| --- | --- | --- |
| `admissionsDocuments` | Application/requirement 1:N upload versions. `schoolId`, `applicationId`, `requirementId`, `category`, opaque `documentKey`, `storageId`, filename, MIME, bytes, SHA-256, version, state, sensitivity, uploadedByGuardianId, supersedes ID, quarantine/deletion/retention metadata. | `by_application_id_and_category_and_version`; `by_document_key`; `by_storage_id`; `by_school_id_and_state_and_updated_at`; `by_application_id_and_requirement_id` |
| `admissionsDocumentReviews` | Document 1:N append-only reviews. `schoolId`, `documentId`, reviewer user ID, result, reason code, safe guardian message, internal note, createdAt. | `by_document_id_and_created_at`; `by_school_id_and_reviewer_user_id_and_created_at` |
| `admissionsStaffGrants` | School/user explicit permissions. `schoolId`, `userId`, permission, optional programme/intake scope, granted/revoked metadata. | `by_school_id_and_user_id`; `by_school_id_and_permission`; `by_user_id_and_permission` |
| `admissionsReviewAssignments` | Application 1:N assignments. `schoolId`, `applicationId`, `assigneeUserId`, role, state, dueAt, assigned/completed metadata. | `by_school_id_and_assignee_user_id_and_state`; `by_application_id_and_state`; `by_school_id_and_state_and_due_at` |
| `admissionsReviewEvents` | Application 1:N append-only completeness/review/change-request/note events. `schoolId`, `applicationId`, snapshotId, actor, eventType, visibility, reason code, message, metadata. | `by_application_id_and_created_at`; `by_school_id_and_event_type_and_created_at`; `by_school_id_and_visibility_and_created_at` |
| `admissionsEvaluations` | Application 1:N entrance assessment/interview rows. `schoolId`, `applicationId`, type, scheduled/completed state, result code, bounded score fields, evaluator, version, notes. | `by_application_id_and_type_and_version`; `by_school_id_and_state_and_scheduled_at`; `by_school_id_and_evaluator_user_id_and_state` |
| `admissionsDecisions` | Application 1:N immutable decision versions; one current pointer on application. `schoolId`, `applicationId`, `version`, state, reason code, rationale, decidedBy, decidedAt, optional supersedes ID. | `by_application_id_and_version`; `by_school_id_and_state_and_decided_at`; `by_school_id_and_decided_by_and_decided_at` |
| `admissionsConversions` | Application 1:1 ledger. `schoolId`, `applicationId`, accepted decision/snapshot IDs, idempotency key, state, lease/attempt fields, selected class/admission number and approved family resolution, output guardian/family/member/student-user/student IDs, error code, completedAt. | `by_application_id`; `by_school_id_and_state_and_updated_at`; `by_idempotency_key`; `by_student_id` |
| `admissionsConversionAttempts` | Conversion 1:N append-only attempts. `schoolId`, `conversionId`, attempt number, worker key, started/finished timestamps, outcome, safe error code. | `by_conversion_id_and_attempt_number`; `by_school_id_and_outcome_and_started_at` |
| `admissionsCommunicationOutbox` | Post-commit notices. `schoolId`, application/conversion ID, event key, recipient guardian ID, channel, template/version, state, retry schedule. | `by_school_id_and_state_and_next_attempt_at`; `by_conversion_id_and_event_key`; `by_application_id_and_event_key` |
| `admissionsAuditEvents` | Append-only security/business audit. `schoolId`, actor kind and server-derived actor ID, action, entity type/ID, application ID where applicable, outcome, reason, request correlation ID, minimized metadata, createdAt. No secret or medical body. | `by_school_id_and_created_at`; `by_application_id_and_created_at`; `by_school_id_and_actor_user_id_and_created_at`; `by_school_id_and_action_and_created_at` |
| `admissionsRetentionJobs` | School/application/document cleanup workflow, legal hold, policy/version, state, cursor, dry-run count, approval and execution timestamps. | `by_school_id_and_state_and_scheduled_at`; `by_application_id`; `by_school_id_and_policy_key` |

## 7. Lifecycle contracts

### 7.1 Payment purchase attempt

| From | To | Actor/trigger | Preconditions and invariant | Idempotency/recovery | Terminal? |
| --- | --- | --- | --- | --- | --- |
| — | `created` | Verified guardian mutation | Active product/price; verified email; amount and disclosure snapshotted; unique guardian client key | Same `guardianId + idempotencyKey` returns same row/reference | No |
| `created` | `checkout_pending` | Initialization action + internal mutation | Correct school merchant/mode; provider returned authorization URL | Action retry uses same attempt; if provider outcome is ambiguous, move to `manual_attention`, not a new entitlement | No |
| `created` / `checkout_pending` | `verification_pending` | Return page or poll | Guardian owns attempt; redirect/reference alone is not proof | Re-verification is safe and bounded/backed off | No |
| Any non-void state | `paid` | Verified webhook or server-side provider verification | Signature/verification valid; provider reference, amount, currency, school and mode match snapshot | Event key and purchase reference dedupe; transaction creates/gets exactly one entitlement | Fulfilment terminal; may later be financially superseded |
| `created` | `failed` | Definite initialization failure | No usable checkout session | Guardian may create a new attempt with a new client key | Yes |
| `checkout_pending` / `verification_pending` | `expired` | Scheduler/provider expiry | No verified payment by expiry | A late valid webhook may reopen to `paid` with audit; never ignore money | Usually |
| Any unresolved state | `manual_attention` | Conflicting amount/mode/reference or ambiguous provider response | No entitlement until resolved through verified evidence | Privileged reconciliation records evidence and either reaches `paid` or `failed` | No |
| `paid` | `refunded` / `reversed` | Verified refund/chargeback event | Existing entitlement found | Entitlement is voided if unused; a consumed application is held for manual policy handling, never deleted silently | Yes |

**Replay keys:** guardian client `idempotencyKey`; server `reference`; provider `(provider, mode, providerEventId)`; entitlement `sourcePurchaseAttemptId`.

### 7.2 Entitlement

| From | To | Actor/trigger | Invariant and failure behavior | Terminal? |
| --- | --- | --- | --- | --- |
| — | `available` | Paid purchase transaction | Exactly one row per verified purchase | No |
| `available` | `reserved` | Guardian creates application | Same transaction creates one `admissionsApplications` row and sets its ID; concurrent loser rereads and receives existing application | No |
| `reserved` | `consumed` | First valid submit | Same transaction writes immutable revision 1; consumption cannot be rolled back by UI retry | Yes for application creation/submission |
| `available` / `reserved` | `expired` | Approved intake/policy expiry | Never expire a submitted/consumed slot | Yes |
| `available` / `reserved` | `refunded` / `revoked` | Verified finance event or authorized operator | Existing draft becomes locked/held; audit reason required | Yes |
| `consumed` | `refunded` / `revoked` | Exceptional verified event | Application and snapshots remain; decision/conversion is blocked or escalated according to approved policy | Yes |

A guardian does not delete and replace an application. Before first submission they may reset the same draft record. This preserves the entitlement 1:1 key while supporting correction.

### 7.3 Application and revision

| From | To | Actor/trigger | Rules | Terminal? |
| --- | --- | --- | --- | --- |
| — | `draft` | Guardian reserves slot | Entitlement must be available and owned by guardian | No |
| `draft` | `submitted` | Guardian submit | Validate resolved form, uploaded required documents, declaration, intake timing; atomically write revision 1 and consume slot | No |
| `submitted` | `under_review` | Assigned reviewer | Submitted data is locked | No |
| `submitted` / `under_review` | `changes_requested` | Reviewer with permission | Reason and guardian-safe message required; latest snapshot stays immutable; selected working fields unlock | No |
| `changes_requested` | `submitted` | Guardian resubmit | Revalidate all current requirements; write revision N+1; entitlement remains consumed | No |
| `submitted` / `under_review` | `decisioned` | Decision transition | Current decision is accepted/rejected; application data remains immutable | Yes, unless manager reopens through a new decision version |
| `draft` / `submitted` / `under_review` / `changes_requested` | `withdrawn` | Owning guardian or authorized staff with evidence | No conversion; preserve payment, snapshot and audit records | Yes |
| Any terminal state | `archived` | Retention workflow | Redaction/deletion policy completed; minimal tombstone remains | Yes |

There is no direct edit API in `submitted`, `under_review`, or `decisioned`. Requesting changes unlocks only an explicit set of fields/document requirements. Staff corrections are not silent edits; they are review events and require guardian resubmission or a separately visible administrative correction snapshot.

### 7.4 Document review

| From | To | Actor/trigger | Rules | Terminal? |
| --- | --- | --- | --- | --- |
| — | `uploaded` | Guardian completes bound upload | Validate `_storage` existence, MIME, size and application ownership; unbound uploads are not documents | No |
| `uploaded` | `in_review` | Authorized reviewer opens review | Access and download/view are audited | No |
| `uploaded` / `in_review` | `accepted` | Reviewer | Requirement/category match; human decision only | Stable, can be superseded |
| `uploaded` / `in_review` | `rejected` | Reviewer | Reason code and guardian-safe explanation required | Yes for that version |
| Any non-deleted state | `quarantined` | Malware/security signal or privacy officer | No guardian/staff download except security role | No |
| `rejected` / `accepted` | `superseded` | New bound version | New row points to prior version; prior file remains for audit/retention | Yes for old version |
| Eligible state | `deleted` | Approved retention job | Storage deletion only after reference/hold check; tombstone and digest retained | Yes |

Document acceptance is not admission acceptance. Birth certificates and medical records must never appear in queue list payloads or public URLs.

### 7.5 Admission decision

| From | To | Actor/trigger | Rules | Terminal? |
| --- | --- | --- | --- | --- |
| — | `in_evaluation` | Reviewer starts | Current submission exists | No |
| `in_evaluation` | `ready_for_decision` | Reviewer/review lead | Required completeness/document checks and configured assessments are resolved | No |
| `ready_for_decision` | `waitlisted` | Decision maker | Reason and current snapshot recorded | No |
| `ready_for_decision` / `waitlisted` | `accepted` | Decision maker | Capacity/policy warning acknowledged; no automatic conversion | Yes |
| `ready_for_decision` / `waitlisted` | `rejected` | Decision maker | Approved reason and guardian-safe communication required | Yes |
| Any nonterminal decision | `withdrawn` | Guardian withdrawal | Preserve history | Yes |
| `accepted` / `rejected` | `in_evaluation` | Admissions manager reopen | New decision version, explicit reason, audit, and no completed conversion for rejection/reopen | No |

Reviewers may recommend but only `decision.record` grantees decide. A platform admin has no school application access by default.

### 7.6 Conversion

| From | To | Actor/trigger | Rules and retry behavior | Terminal? |
| --- | --- | --- | --- | --- |
| — | `requested` | `conversion.execute` staff | Accepted decision, approved class and admission number, explicit family-resolution choice | No |
| `requested` / `failed_retryable` | `running` | Worker claims lease | One conversion row per application; attempt number increments | No |
| `running` | `succeeded` | Internal transactional conversion | Canonical rows and all output IDs plus success state commit atomically | Yes |
| `running` | `failed_retryable` | Action catches transient/ambiguous failure or stale lease recovery | Transaction made no partial canonical writes; safe code recorded; retry uses same conversion | No |
| `running` | `failed_terminal` | Deterministic conflict | Admission number conflict, ambiguous identity/family, missing required approved data; human resolution needed before a new approved request | Yes until privileged resolution |

A client/network interruption after commit is recovered by reading `by_application_id`; `succeeded` returns the same IDs. A stale `running` lease is never assumed successful or failed without checking the ledger.

## 8. Payment sequence and race handling

```mermaid
sequenceDiagram
  participant G as Verified guardian
  participant A as apps/apply
  participant C as Convex admissions
  participant P as School Paystack merchant
  participant W as Shared webhook router

  G->>A: Buy one application slot
  A->>C: createPurchaseAttempt(productSlug, clientIdempotencyKey)
  C-->>A: attemptId + server reference (state=created)
  A->>C: initializePurchase(attemptId)
  C->>P: initialize(amount, reference, admissions metadata)
  P-->>C: authorization URL
  C-->>A: checkout_pending + URL
  G->>P: Complete checkout
  par Redirect may happen first
    P-->>A: return?reference=...
    A->>C: verifyOwnedPurchase(reference)
    C->>P: server-side verify
  and Webhook may happen first or repeat
    P->>W: signed event(reference)
    W->>C: internal verified admissions event
  end
  C->>C: dedupe event and reference; validate amount/currency/school/mode
  C->>C: atomically mark paid + create/get one entitlement
  C-->>A: paid only after verification; otherwise pending/manual attention
```

Rules:

- The purchase row exists before external initialization, so an early webhook can resolve it.
- Reference namespace is non-PII and collision-resistant (for example `adm_<random>`); webhook dispatch uses persisted context, not untrusted metadata alone.
- The shared webhook route verifies with the merchant secret resolved from the persisted school/mode context before invoking admissions state mutation.
- Duplicate webhooks return success after replaying the existing outcome. Amount/currency mismatch never creates a slot.
- A delayed valid webhook after a pending/expired return may still settle the purchase. A second truly paid purchase yields a second slot because money was received; the UI suppresses parallel attempts and finance staff can refund accidental duplicates.

## 9. Draft, submission, and change sequence

```mermaid
sequenceDiagram
  participant G as Guardian
  participant C as Convex
  participant S as Private storage
  participant R as Reviewer

  G->>C: createOrResumeApplication(entitlement)
  C->>C: atomically reserve entitlement + create/get application
  G->>C: save typed section (expectedVersion)
  C-->>G: nextVersion
  G->>C: requestDocumentUpload(application, requirement)
  C-->>G: one-time upload URL
  G->>S: upload
  G->>C: bindDocument(storageId, metadata)
  C->>C: validate storage metadata and ownership
  G->>C: submit(application, expectedVersion, declarationVersion)
  C->>C: validate + create immutable snapshot/items + consume slot
  R->>C: requestChanges(fields/requirements, reason)
  C-->>G: changes_requested; prior snapshot remains locked
  G->>C: edit allowed fields and resubmit
  C->>C: create immutable revision N+1
```

Optimistic `expectedVersion` prevents silent overwrite from two devices. Autosave conflicts return a safe conflict code and current version, not partial server merges of sensitive fields.

## 10. Authorization and tenant isolation

### Permission vocabulary

`settings.view`, `settings.manage`, `applications.list`, `applications.view_basic`, `applications.view_sensitive`, `documents.review`, `documents.download`, `reviews.assign`, `reviews.record`, `decisions.record`, `conversions.execute`, `audit.view`, `retention.manage`, `grants.manage`.

### Matrix

| Actor | Public offering | Own slots/drafts | School queue/basic | Sensitive fields | Documents | Review | Decision | Convert | Settings/grants | Audit/retention |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Anonymous prospect | Published summary/link only | — | — | — | — | — | — | — | — | — |
| Verified guardian | Yes | Own guardian ID only | — | Own current/submitted safe view | Own upload; signed read only when policy allows | Respond to requests | Read own safe status | — | — | Own activity summary only |
| Admissions clerk | Yes | — | Granted `list/view_basic` | No by default | No by default | Completeness if granted | Recommend only | — | Limited settings if granted | No |
| Reviewer | Yes | — | Assigned/scoped | Only if explicit `view_sensitive` | Review; download only if separately granted | Yes | Recommend | — | — | Application audit if granted |
| Decision maker | Yes | — | Scoped | Minimum needed | Review result; raw download not implied | Yes | Yes | — | — | Decision history |
| Conversion operator | Yes | — | Accepted records | Approved snapshot fields needed for conversion | Photo only if provenance transfer approved | Read | Read | Yes | — | Conversion audit |
| School admissions manager | Yes | — | School-wide | Explicit sensitive grant still required | Explicit grant | Assign/manage | Yes | Yes if granted | Admissions settings | If granted |
| Privacy officer | No special public rights | — | Metadata as needed | Purpose-based | Quarantine/delete/hold | — | — | — | Retention settings | Yes |
| Platform admin/support | Public only by default | — | **No default access** | No | No | No | No | No | Foundation metadata only | Break-glass only, time-bound, reasoned, audited |

Every function follows: authenticate -> derive actor -> resolve persisted object -> compare object `schoolId` to actor grant scope -> check ownership/permission -> perform bounded indexed read/write. A school slug selects a public tenant; it never authorizes private data. IDs from another school return a generic not-found/denied result with no existence oracle.

Rate-limit public catalogue reads by IP hash/school, auth/signup/verification by identity and IP, checkout creation by guardian/school, upload URLs by guardian/application, and signed document reads by actor/document. Store only rotating salted IP hashes, not durable raw IP addresses.

## 11. Proposed API and link contracts

Names below are the contract B0/B1 should freeze; all Convex functions have explicit argument and return validators. List queries are paginated or bounded and use indexes rather than `.filter()`.

### Public route contract (`ApplicationLink` v1)

```ts
type ApplicationLinkV1 = {
  version: "1";
  schoolSlug: string;
  href: string; // absolute canonical URL
  availability: "open" | "upcoming" | "paused" | "closed" | "unavailable";
  intakeSlug: string | null;
  opensAt: number | null;
  closesAt: number | null;
};
```

- Canonical school entry: `https://apply.<product-domain>/s/{encodeURIComponent(schoolSlug)}`.
- Optional stable intake campaign: `/s/{schoolSlug}/i/{intakeSlug}`.
- Authenticated dashboard: `/s/{schoolSlug}/account`.
- Application UI: `/s/{schoolSlug}/applications/{opaquePublicId}`. The opaque ID is not a secret and grants no access.
- Payment return: `/s/{schoolSlug}/payments/paystack/return?reference={opaqueReference}`; ownership and provider verification are mandatory.
- No document route contains a storage ID. A checked app route such as `/api/admissions/documents/{opaqueDocumentKey}` may exchange session authorization for an immediate redirect/stream and write an audit event.
- Links never encode price, form version, guardian identity, child identity, storage ID, or site hostname.
- Managed and external sites consume/copy the same absolute `href`. `apps/sites` may redirect its `/apply` CTA to it, but `apps/apply` does not require a cookie from the website domain.

Public resolver contract: `getApplicationLink({ schoolSlug, intakeSlug? })` returns `ApplicationLinkV1` and a safe school brand/fee disclosure summary, or a non-enumerating unavailable response. B0's shared resolver must use explicit slug/ID, not request-host-only guessing.

### Guardian-facing functions

| Function | Kind | Contract / authorization |
| --- | --- | --- |
| `public.getOffering` | public query | `{schoolSlug, intakeSlug?}` -> bounded published school/programme/intake/product summary and link; no drafts or private IDs |
| `guardian.getOrCreateIdentity` | mutation | Server-derived auth token; verified contact evidence; no caller user ID |
| `guardian.listWorkspace` | paginated query | Own entitlements/applications across selected school; redacted statuses only |
| `payments.createAttempt` | mutation | Product/price resolved server-side; verified guardian; client key dedupe |
| `payments.initializeAttempt` | action | Own attempt; merchant resolved internally; no secret returned |
| `payments.verifyReturn` | action | Own reference; provider verification; safe status only |
| `applications.createOrResume` | mutation | Own available/reserved entitlement; atomic reserve |
| `applications.getDraft` | query | Own application; current form/version and safe status |
| `applications.saveCoreSection` / `saveAnswer` / `deleteAnswer` | mutations | Own editable application; expected version; server field validation |
| `documents.createUploadUrl` | mutation | Own editable application/requirement; rate/size/category policy checked |
| `documents.bindUpload` | mutation | Validate `_storage` metadata; bind once; reject orphan/mismatch |
| `documents.getOwnAccess` | mutation | Own document and allowed state; write the audit event and generate the immediate signed URL after the same authorization check |
| `applications.submit` | mutation | Atomic validation, snapshot, state, entitlement consumption |
| `applications.withdraw` | mutation | Own application and permitted state; reason/audit |

### Staff-facing functions

| Function | Kind | Contract / authorization |
| --- | --- | --- |
| `staff.listQueue` | paginated query | Server-derived school/grants; indexed intake/state/assignee filters; redacted list projection |
| `staff.getApplicationDetail` | query | `view_basic`; sensitive sections omitted unless separately granted |
| `staff.getDocumentAccess` | mutation | Explicit document permission; reason/context; audit before signed URL |
| `staff.assignReview` | mutation | `reviews.assign`; same school/scoped assignee |
| `staff.recordDocumentReview` | mutation | `documents.review`; legal transition and append-only review |
| `staff.requestChanges` | mutation | `reviews.record`; fields/requirements whitelist + guardian-safe message |
| `staff.recordEvaluation` | mutation | `reviews.record`; configured type, versioned result |
| `staff.recordDecision` / `reopenDecision` | mutation | `decisions.record`; transition/precondition checks |
| `staff.requestConversion` | action/mutation pair | `conversions.execute`; accepted decision and explicit class/admission/family resolution |
| `staff.getAudit` | paginated query | `audit.view`; no sensitive bodies |
| `settings.*` | query/mutations | `settings.manage`; draft/publish/retire only, with immutable published versions |

### Internal-only functions

- Merchant secret resolution and payment initialization helper.
- Shared verified webhook dispatch and `payments.recordVerifiedEventInternal`.
- Conversion transaction, stale-lease recovery, and post-commit outbox scheduling.
- Retention dry-run/batched cleanup and orphan upload cleanup.
- Communication sender/retry.

No sensitive webhook, conversion, retention, or communication mutation is public.

## 12. Field taxonomy and default policy

| Group | Default | Examples | Purpose / rule |
| --- | --- | --- | --- |
| Core required | Required | Child legal first/last name, date of birth, selected programme/intake/requested entry, primary guardian name/relationship, verified email, declaration acceptance | Identify the application, determine age/entry context, contact the accountable adult, capture attestation |
| Core optional | Optional | Middle/preferred name, phone (unless approved operational need), current address, previous school, gender/sex, nationality/country of birth, siblings | Collect only when needed; sibling names are not a substitute for separate paid applications |
| Configurable low/moderate risk | Optional by default | Language support, transport interest, visit preference, start-date notes | Typed fields with owner, validator, purpose, and published form version |
| Documents | Configurable; minimal | Child photo, birth certificate, prior report | Each requirement needs purpose, MIME/size, retention, visibility, and required-mode approval |
| Highly sensitive | Disabled and optional by default | Medical/allergy details, doctor's report, blood group, genotype, religion, disability/support need | Conditional, purpose-specific, restricted permission, short retention; medical questions should ask only what is needed for safety/accommodation |
| Government identity | Prohibited by default | NIN, passport number/copy | Enable only after documented lawful purpose, owner/legal approval, access/retention plan; never a template default |
| AI-derived | Disabled | OCR text, document matching, anomaly score | Future opt-in table/permission boundary; human review mandatory; never an admissions decision |

Every high-risk field has an explicit purpose or remains unavailable. The historical OBHIS paper fields do not override this policy. A birth certificate may be approved as an identity/age document; a doctor's report should be conditional on disclosed support/safety needs, not universally required without approval.

## 13. Private storage and document access

1. Authorize guardian ownership or explicit school grant before issuing an upload URL.
2. Bind an upload to one application/requirement promptly. Validate metadata through `ctx.db.system.get("_storage", storageId)`, allowed MIME, size, expected category, and one-time binding.
3. Use opaque application/document keys in client routes. Never return raw `storageId` in queue/list contracts.
4. Generate a signed URL only after a fresh authorization check. Do not persist it. Treat URL lifetime as storage-platform behavior and keep the app exchange immediate.
5. Audit staff view/download, guardian download, quarantine, review, supersession, retention hold, and deletion. List views show document status/category, not previews.
6. Keep medical/government documents behind explicit grants separate from ordinary review. Platform support has no default access.
7. Quarantined files are not retrievable by ordinary guardians/reviewers.
8. Clean unbound uploads after a short approved window. Delete stored objects only after checking snapshot manifests, accepted photo provenance, legal holds, and other references.
9. Security headers prevent indexing/caching of application/document pages; logs and error telemetry redact names, emails, references, storage IDs, and answers.

## 14. Accepted conversion algorithm

```mermaid
sequenceDiagram
  participant O as Conversion operator
  participant A as Admissions action
  participant T as Internal Convex transaction
  participant C as Canonical tables
  participant Q as Communication outbox

  O->>A: requestConversion(application, class, admissionNo, familyResolution, key)
  A->>A: derive actor; check conversion grant and school
  A->>T: claim/create conversion ledger
  T->>T: verify accepted decision + latest snapshot + prerequisites
  alt already succeeded
    T-->>A: recorded output IDs
  else new conversion
    T->>C: resolve/create guardian user + family + familyMember
    T->>C: resolve/create student user + student + class placement
    T->>C: attach approved photo reference with application_upload provenance
    T->>T: record all output IDs and succeeded
    T-->>A: output IDs
  end
  A->>Q: enqueue onboarding after successful commit (deduped)
  A-->>O: success/recoverable status
```

Detailed contract:

1. Derive staff identity and grant; never accept an actor user ID.
2. Load application, current accepted decision, accepted submission snapshot, and conversion ledger by indexed IDs; verify one `schoolId` throughout.
3. Require staff-approved `classId` and `admissionNumber`; check active class and `students.by_school_id_and_admission_number`.
4. Resolve the authenticated guardian's school `users` parent membership through the B0 auth bridge. An exact same-school identity is reusable. Email/name similarity creates a warning, never a cross-school lookup or automatic merge. Ambiguous same-school matches produce `failed_terminal` pending a human choice.
5. Use an explicitly approved existing `familyId`, a sole family linked to that parent, or create a family. Link the guardian with `familyMembers`; other paper-form contacts are not given portal accounts until separately verified/invited.
6. Check for an existing conversion by `applicationId`. Optional child name+DOB matching is a same-school warning only. Staff may explicitly choose an existing canonical student if policy allows; otherwise create a deterministic student `users` row and `students` row.
7. Copy only the approved mapping from the accepted snapshot. Sensitive custom/medical fields remain in admissions unless canonical student schema and policy explicitly require them.
8. If an accepted application photo is selected, reference it as the student's fallback photo and record provenance `application_upload`, source application/document, and timestamp. A later school photo may become preferred without deleting the admissions original. Retention cannot delete the underlying storage object while canonical provenance holds it.
9. Write/patch canonical rows and mark `admissionsConversions.succeeded` with every output ID in the same Convex mutation. Convex transaction rollback means a thrown mutation leaves no partial canonical rows.
10. The outer action records safe retryable/terminal failure in a separate mutation. Stale running leases are recovered. Replays return prior IDs.
11. Enqueue portal onboarding/notifications only after success, keyed by `(conversionId, eventKey, recipient)`. Communication failure does not roll back or duplicate conversion.

### Proposed canonical additive fields/contracts

B0 should add or freeze: `students.by_school_id_and_admission_number`; an application-origin/provenance mapping (either optional `sourceApplicationId` plus index or an admissions-owned one-to-one origin row); photo provenance fields/table; and a school-auth membership resolver. Existing records remain valid through optional fields.

## 15. Data classification, consent, and retention proposal

### Classification

| Class | Examples | Controls |
| --- | --- | --- |
| Public | Published programme name, intake dates, approved fee disclosure, application link | Public query; publication workflow |
| Internal | Queue state, assignment, operational reason codes | School grant; no public response |
| Personal | Guardian name/email/phone/address, previous school | Owner/scoped staff; redacted lists/logs |
| Child confidential | Child name/DOB/photo, submission answers | School/owner scope; least privilege; immutable snapshots |
| Highly sensitive | Birth certificate, government ID, medical/allergy data, genotype/blood group/religion | Disabled/optional by default; explicit purpose/grant; audited access; shortest retention |
| Financial/security | Merchant context, payment reference/events, webhook body, auth identifiers, IP hash | Secrets internal only; payload minimization; strict audit and retention |

### Consent/declaration

- Store exact immutable declaration/consent version, text digest, purpose, guardian identity, signer name/relationship, acceptance timestamp, and submission revision.
- Separate necessary service declaration from optional communications or sensitive-data consent. No bundled pre-checked consent.
- Changing declaration text requires a new published version. Existing submissions retain old evidence.
- A request for sensitive information names its purpose and visibility before collection.

### Proposed defaults requiring privacy/legal approval

| Record | Proposed default | End-of-window action |
| --- | --- | --- |
| Unsubmitted abandoned draft, including files | 90 days after last guardian activity, with notice before cleanup | Redact/delete child answers and files; retain minimal purchase/entitlement/audit tombstone |
| Rejected/withdrawn application sensitive fields/files | 180 days after final decision/withdrawal | Delete files and redact sensitive answers unless appeal/legal hold applies |
| Accepted/converted general submission snapshot | Student relationship plus 7 years (jurisdictional approval required) | Redact/delete according to school records policy while retaining conversion provenance |
| Accepted identity/medical documents | Prefer 12 months after conversion unless a documented school/legal need requires longer | Delete object and retain category/digest/tombstone; preserve selected photo if canonical hold exists |
| Payment accounting record | 7 years (finance/legal approval required) | Retain minimized financial ledger; delete gateway payload detail earlier |
| Raw/encrypted webhook payload, if retained | 30 days | Delete raw body; retain digest and normalized event result |
| Security/business audit | 7 years, with sensitive values excluded | Retain append-only event/tombstone |
| Unbound storage upload | 24 hours | Batch delete after reference check |

Retention jobs are dry-run first, require a policy version and authorized approval, process bounded batches, respect legal holds/appeals, and leave non-sensitive tombstones. No automatic destructive cleanup ships until windows and notices are approved.

## 16. Error and recovery contract

Use stable safe codes plus non-sensitive user copy. Internal details go to restricted telemetry, not client errors.

| Condition | Safe code | User/staff behavior | Recovery |
| --- | --- | --- | --- |
| Unknown/disabled school or intake | `OFFERING_UNAVAILABLE` | Generic unavailable page; do not enumerate private config | Use canonical link/settings |
| Auth/contact not verified | `VERIFICATION_REQUIRED` | Explain verification step | Resume same intent after verification |
| Price changed before attempt | `PRICE_CHANGED` | Show new disclosure and require confirmation | New client idempotency key after consent |
| Payment pending/delayed webhook | `PAYMENT_PENDING` | Never claim a slot/place | Poll with backoff; webhook settles |
| Amount/mode/reference conflict | `PAYMENT_REVIEW_REQUIRED` | No slot; support reference shown partially | Finance reconciliation with evidence |
| Concurrent entitlement reservation | `APPLICATION_ALREADY_EXISTS` | Open existing application | Indexed reread |
| Autosave version conflict | `DRAFT_VERSION_CONFLICT` | Preserve local input, show refresh/compare | Reload current version and resubmit |
| Missing required upload/field | `APPLICATION_INCOMPLETE` | Field/requirement keys only | Fix and resubmit |
| Locked submitted data | `APPLICATION_LOCKED` | Explain current state | Reviewer must request changes |
| Unauthorized/cross-school object | `NOT_FOUND_OR_DENIED` | No existence details | Correct account/school; audit denial |
| File mismatch/quarantine | `DOCUMENT_UNAVAILABLE` | No signed URL | Replace or privacy/security review |
| Conversion identity/admission conflict | `CONVERSION_RESOLUTION_REQUIRED` | No partial success | Staff resolves explicit candidate/input and retries same conversion |
| Communication failure after conversion | `ONBOARDING_PENDING` | Student remains converted | Outbox retry; no reconversion |

## 17. Test matrix

| Area | Required tests |
| --- | --- |
| Tenant isolation | Guardian/staff from school A cannot read/mutate school B IDs; unknown IDs do not reveal existence; platform admin has no default access |
| Identity | Server derives guardian from token; spoofed user/guardian IDs rejected; multi-school same login works; archived/revoked account denied |
| Payment | Duplicate create key returns same attempt; redirect without verification remains pending; webhook first/late/duplicate; amount/currency/mode mismatch; invalid signature; refund/reversal; two genuine purchases produce two slots |
| Entitlement/application | Concurrent create yields one application; draft reset uses same row; one slot cannot produce two submitted applications; sibling slots work; revoked/refunded slot locks correctly |
| Snapshot | Submitted rows cannot be edited; revision digest stable; request-change/resubmit creates N+1 without changing N; declaration version preserved |
| Documents | MIME/size/storage binding; unbound cleanup; guardian ownership; staff grant separation; signed access audit; no list storage IDs; rejected/abandoned file not public/enumerable; quarantine denial |
| Review/decision | Assignment scope; invalid transitions rejected; reviewer cannot decide; decision maker cannot download without grant; accepted/rejected reopen creates a new version |
| Conversion | Not accepted denied; admission number conflict; ambiguous parent/family; transaction rollback; client interruption/replay; stale lease; exact same output IDs; no duplicate family/student; photo provenance/retention hold |
| Retention | Dry run, legal hold, bounded batch, accepted-photo reference preservation, tombstone, cross-school denial |
| API/query quality | Explicit validators/returns, bounded/paginated reads, named indexes, no `.filter()` for planned lookups, no public internal functions |
| E2E | Managed-site link and external-site link reach same canonical school; verified signup; pending→paid; draft/upload/submit; request changes; decide; convert; onboarding retry |
| Security/a11y | CSRF/origin/auth behavior, rate limits, cache/noindex headers, redacted logs, keyboard/mobile/WCAG 2.2 AA, session timeout/re-auth before sensitive download/decision |

Use `convex-test` + Vitest edge runtime for Convex contracts and Playwright for cross-host flows. Webhooks and provider verification use deterministic fakes; no real payment or AI service runs in tests.

## 18. Phased build mapping

| Phase | Contract delivered |
| --- | --- |
| `B0` integration owner | Shared auth identity/membership resolver; `ApplicationLinkV1`; payment reference namespace/dispatch and generalized merchant adapter inputs; additive admissions schema/validators/indexes; student admission-number and photo/application-origin compatibility; grants primitive; generated API and migration contract tests |
| `B1` admissions backend | Admissions functions/tables, state guards, payment entitlement, snapshots, private documents, review/decision, conversion ledger/algorithm, audit/retention primitives, focused Convex tests |
| `B2` public surface | `apps/apply`, guardian auth/verification, payment truth states, slot dashboard, autosave form, uploads, declarations, status/recovery, accessible E2E |
| `B3` admin operations | Settings publication, grants, redacted queues, review/document/decision/conversion/audit surfaces, admin tests |
| `B4` site core | Consume absolute `ApplicationLinkV1` in structured site content; no admissions lifecycle logic |
| `B5` OBHIS site | Approved admissions CTA only; no unverified price/contact/legal claim |
| `B6` integration/release | Shared webhook routing, generated types/manifests reconciliation, cross-host E2E, security/privacy review, operational retention/payment/DNS/secrets runbook and approvals |

## 19. Exact downstream contracts

### B0 must consume and freeze

1. **AuthIdentity v1:** server-derived `authTokenIdentifier` as canonical ownership key, Better Auth user-ID bridge, and a resolver that returns zero-to-many active school `users` memberships without `.unique()` assumptions.
2. **ApplicationLink v1:** the exact absolute school-slug/intake-slug contract and availability enum in section 11; it cannot depend on a request hostname.
3. **PaymentReference v1:** non-PII `adm_` namespace, persisted school/provider/mode/domain context, shared webhook resolver/dispatcher, provider event replay key, and generalized Paystack initialization metadata that is not invoice-only.
4. **Schema ownership:** all section 6 tables/validators/indexes as additive foundation changes; no direct G1 schema edit. B0 may stage the tables and shared validators while B1 owns behavior.
5. **Canonical conversion compatibility:** `students.by_school_id_and_admission_number`, application-origin uniqueness, and photo provenance/retention-hold contract, all optional for existing rows.
6. **AdmissionsPermission v1:** the permission vocabulary and server-derived school grant resolver; platform support default deny.
7. **Compatibility/migration tests:** old schools/users/students/billing records continue to validate; no destructive backfill; generated API is regenerated rather than hand-edited.

### D1 must consume without changing

- All lifecycle states/transitions and safe error/recovery codes in sections 7 and 16.
- One verified guardian, one paid slot, one durable application; multiple sibling slots allowed.
- Redirect is pending until verified; payment/refund/manual-attention truth states.
- Submitted data lock, explicit request-change field scope, immutable revision timeline, withdrawal, decision, and conversion status.
- Field classification/defaults, conditional sensitive data, declaration version evidence, private document behavior, no storage IDs/previews in lists.
- Route map and guardian/staff API expectations in section 11, including mobile/low-bandwidth autosave conflict and session re-auth for sensitive actions.

### D3 must consume without changing

- Catalogue/form/product/declaration entities and draft→publish→retire immutability rules in section 6.
- Permission vocabulary/matrix, especially separate sensitive view, document download/review, decision, conversion, audit, retention and grant permissions.
- Each configurable field/requirement must capture owner, type/validator, required mode, purpose, data class, condition, access, retention, preview, publication and rollback behavior.
- `slotCount = 1` for v1, immutable price/disclosure versions, no arbitrary HTML/JS/layout, no settings edit that mutates submitted snapshots.
- The exact `ApplicationLinkV1` copy/preview contract and public availability states.

## 20. Open business approvals and risks

### Required approvals before build/release behavior is finalized

- Current application price/currency, refund/non-refundable policy, duplicate-payment handling, payment methods, and whether one checkout may ever buy quantity >1 (v1 recommendation: no).
- Required versus conditional documents per programme, file limits, and whether a birth certificate is mandatory.
- Whether phone verification is required in addition to verified email.
- Named reviewer/decision/conversion/privacy roles and who may see/download medical or identity documents.
- Entrance assessment/interview rules, waitlist behavior, capacity handling, change-request limits, appeal/reopen policy, and decision communication wording.
- Admission-number allocation and class-placement approval workflow.
- Whether only the authenticated guardian is converted to a parent portal member or additional contacts may be invited after separate verification (recommendation: authenticated guardian only by default).
- Retention windows, notices, appeal/legal holds, jurisdictional basis, and financial/audit retention.
- OBHIS-specific price, contacts, required documents, declaration/legal language, medical questions, school claims, and image rights.

### Residual architectural risks

- **High:** Auth key/multi-school membership inconsistency can orphan ownership or break conversion unless B0 lands first.
- **High:** Existing invoice-specific webhook routing can misroute or reject admissions events unless the shared dispatcher is reviewed and replay-tested.
- **High:** Minors' documents and medical data create breach and over-collection risk; release must block on explicit permissions, audit, retention and source-content approval.
- **High:** Canonical identity/family matching is inherently ambiguous; conversion must stop for human resolution rather than merge by email/name similarity.
- **Medium:** Linking an application photo to `students.photoStorageId` couples admissions retention to the canonical profile; provenance and reference holds are mandatory.
- **Medium:** Existing broad admin role is insufficient; permission bootstrap and emergency support access need an approved operating model.
- **Medium:** Paystack merchant/webhook capabilities and refund event semantics must be validated per school before production.

## 21. Acceptance mapping

- One paid slot cannot yield two submissions: unique entitlement/application mapping plus atomic first submission/consumption.
- Siblings: one guardian can own multiple independently paid entitlements.
- Webhook replay: provider event and purchase source keys return one entitlement and one application remains separate.
- Rejected/abandoned files: private storage, non-enumerating routes, grants, signed access, audit and retention cleanup.
- Interrupted conversion: one application conversion ledger, atomic canonical transaction, lease recovery, exact output replay.
- High-risk fields: disabled or optional by default with stated purposes and explicit approval gates.
- Shared-file changes: listed only as B0 proposals; no runtime/schema/UI edits are made by G1.
