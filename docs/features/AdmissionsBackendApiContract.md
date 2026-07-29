# B1 Admissions Backend API Contract

B1 exposes tenant- and ownership-checked Convex functions under `functions/admissions/**`. All private IDs are inputs only; list/read output excludes storage IDs and raw document URLs.

## Public bootstrap APIs (B2)

All public bootstrap routes are keyed by `schoolSlug`, optional `intakeSlug`, and opaque public references. They never return Convex document IDs, storage IDs, or signed document URLs.

- `public.getEntry({ schoolSlug, intakeSlug? })` → non-enumerating published programme/intake/offering projection. It returns `unavailable` for unknown, disabled, unpublished, productless, or improperly configured offerings; `closed` and `paused` expose no purchasable offering.
- `public.getPublishedConfiguration({ schoolSlug, intakeSlug? })` → only the selected published form's active typed fields, published document requirements, and latest published declaration. Field and requirement references are stable keys, not IDs. Draft/retired configuration and staff metadata are excluded.
- `public.getApplicationConfiguration({ schoolSlug, publicReference })` → owner-authorized projection of the exact form, declaration, and requirement versions immutably bound to that application. It remains available for retired historical versions and closed intakes; it never rolls a draft forward to the current public form.
- `public.getGuardianWorkspace({ schoolSlug, limit? })` → authenticated owner-only, bounded slot/application cards keyed by the selected school slug. It returns no entitlement IDs, document IDs, storage IDs, or URLs and supports multiple separately purchased child slots across sessions.
- `public.getGuardianApplication({ schoolSlug, publicReference })` → authenticated owner-only redacted draft/status projection, safe guardian messages, revision/version, persisted contact/document metadata, and exact `permittedEdits` (`coreKeys`, `fieldKeys`, `requirementKeys`). The opaque `publicReference` is school-scoped and is not authority by itself.
- `public.saveContactByPublicReference`, `public.withdrawByPublicReference`, and `public.getOwnDocumentAccessByPublicReference` persist guardian contacts, retain withdrawal history, and issue checked owner-only temporary document access without exposing storage IDs.
- `public.createAttemptForOffering({ schoolSlug, intakeSlug?, idempotencyKey, provider, providerMode })` → server-resolved price/disclosure purchase attempt without a product ID.
- `public.createOrResumeForOffering({ schoolSlug, intakeSlug? })` → reserves/resumes one owned slot and returns only an opaque application reference.
- `public.saveCoreByPublicReference`, `public.saveAnswerByPublicReference`, and `public.submitByPublicReference` accept school slug + opaque application reference. `saveAnswer...` takes a published field key, not a form-field ID.
- `public.createUploadUrlByPublicReference` and `public.bindUploadByPublicReference` take a requirement key, not a requirement ID. The storage ID returned by Convex upload is transient request data only; it must never be placed in a route, list, log, or durable client state.
- `public.initializeAttemptByReference` and `public.verifyReturnByReference` take the opaque `adm_` reference and never return an attempt or entitlement ID. A redirect remains pending until server verification reports `paid`.

## Guardian APIs (B2)

- `guardian.getOrCreateIdentity({})` → `{ guardianId, status, verificationRequired }`. Identity derives from `tokenIdentifier`; B2 must satisfy auth verification before checkout.
- `guardian.listWorkspace({ schoolId, limit? })` → bounded entitlement/application cards.
- `payments.createAttempt({ productId, idempotencyKey, provider, providerMode })` → server-resolved immutable price/disclosure snapshot and `adm_` reference. One key is replay-safe.
- `payments.initializeAttempt({ attemptId })` → `{ state, checkoutUrl }`; `checkout_pending` is not payment success. `payments.verifyReturn({ attemptId })` server-verifies the provider receipt and amount/currency before replay-safe fulfilment. Signed Paystack `charge.success`, pending/failed charge or refund, processed refund, reversal, chargeback, and dispute lifecycle events are persisted and replayed idempotently. Only success creates an entitlement; refunds/reversals void unused slots and create a durable finance hold after reservation/consumption. Receipt mismatch is distinct from provider pending/failed state and from genuine manual attention.
- `applications.createOrResume({ entitlementId })` → one durable application per entitlement.
- `applications.getDraft({ applicationId })`, `saveCoreSection(...)`, `saveAnswer(...)`, `submit({ applicationId, expectedVersion, signerName, signerRelationship })`.
- `documents.createUploadUrl({ applicationId, requirementId })`, `bindUpload({ applicationId, requirementId, storageId, fileName })`, `getOwnAccess({ documentKey, action })`. B2 must never put storage IDs in a route or persist returned signed URLs.

## Staff APIs (B3)

- `staff.listAccessibleIntakes({ schoolId })` returns only labels for exact `applications.list` intake grants; it is a queue-filter projection, not catalogue access.
- `staff.listQueue({ schoolId, intakeId, state?, limit? })` is bounded/redacted and needs `applications.list` for the exact programme/intake.
- `staff.getApplicationDetail({ applicationId })` needs `applications.view_basic`; it returns a tenant-scoped immutable submission-snapshot projection with the core applicant profile, typed answers, and server-derived decision readiness. Highly sensitive/financial-security answers are represented but redacted. `staff.revealSensitiveApplicationDetail({ applicationId, reason })` additionally requires the exact `applications.view_sensitive` scope and fresh authentication, and writes its audit row before returning sensitive values.
- `staff.listApplicationDocuments({ applicationId })` returns metadata and server-selected document identifiers only after `documents.review`; checked file access still requires `staff.getDocumentAccess({ documentKey, action, reason? })`, which uses `documents.review` for view and `documents.download` for download and writes audit before URL. No document key is accepted from a route or queue.
- `staff.listAssignableStaff({ applicationId })` and `staff.listConversionClasses({ applicationId })` provide server-scoped select options for assignment and conversion, avoiding manually entered staff/class IDs.
- `staff.getDocumentAccess({ documentKey, action, reason? })` uses `documents.review` for view and `documents.download` for download, writes audit before URL.
- `staff.recordDocumentReview`, `staff.requestChanges`, `staff.recordDecision`, and `conversions.executeAcceptedConversion` enforce scoped capability and legal state.
- `staff.createRetentionJob` creates a dry-run-ready draft only; B1 never auto-deletes admissions records.

## Phase A stable domain APIs (UI consumers)

The following server-authorized APIs are stable for the later UI phase. They use Convex IDs only after an authenticated owner/staff boundary has been established; public wrappers remain slug/reference based.

- `applications.withdraw({ applicationId, reason })` withdraws only the owning guardian's nonterminal application and retains its history.
- `staff.startReview`, `staff.assignReview`, `staff.recordEvaluation`, `staff.requestChanges`, `staff.recordDecision`, `staff.reopenDecision`, `staff.withdrawApplication`, and `staff.overrideApplicationState` are school/programme/intake capability-gated lifecycle operations. Decisions require a current snapshot, no active finance hold, accepted required documents, and no scheduled evaluation.
- `staff.setFinanceHold({ applicationId, action, reasonCode, note? })` places/releases a durable hold; holds block submission, decisions, and conversion. `staff.getAuditPage({ applicationId, paginationOpts })` is the redacted cursor-based audit projection.
- `staff.listQueuePage({ schoolId, intakeId, state?, paginationOpts })` is the cursor-based redacted queue contract. It does not return names, answers, documents, storage IDs, or URLs.
- `conversions.resolveConversion(...)` persists the explicit staff-approved parent/family/student create-or-link resolution with guardian token provenance. `conversions.executeAcceptedConversion({ applicationId, classId, admissionNumber, familyId?, existingStudentId?, photoDocumentId?, idempotencyKey })` is idempotent and requires that exact current resolution. It never resolves identity from email, rejects unrelated or already-provenanced students, requires a current accepted decision and optional approved current-snapshot photo, writes canonical provenance, and creates one `portal_onboarding` outbox event. `internal.functions.admissions.conversions.recoverStaleLeases` is internal-only bounded stale-lease recovery.
- `settings.getCatalogue`, `settings.getFormConfiguration`, `settings.listApprovalEvidence`, `settings.listDeclarations`, `settings.listProductPrices`, `settings.createProgramme`, `settings.createIntake`, `settings.createProduct`, `settings.publishPrice`, `settings.createDraftForm`, `settings.addDraftField`, `settings.addDraftDocumentRequirement`, `settings.publishForm`, `settings.retireForm`, `settings.setProgrammeStatus`, `settings.setIntakeStatus`, `settings.setProductStatus`, and declaration lifecycle APIs are tenant-scoped persisted B3 catalogue/publication APIs. Status changes are explicit audited publication/rollback controls and never rewrite bound applications; published forms/declarations are immutable; sensitive configuration requires its explicit capability.

Form configuration uses a data-only JSON grammar: validation supports bounded `minLength`, `maxLength`, `pattern`, `choices`, `min`, `max`, and `maxSelections`; conditional requiredness supports one field key with `equals`, `notEquals`, `includes`, or `exists`. No expression, code, HTML, or callback is evaluated. Answer serialization type is derived from the closed server-side field-kind mapping; a client-supplied mismatched type is rejected. Form publication rechecks grammar and current privacy evidence, approver, expiry, purpose, audience, and retention. Price publication requires matching current finance evidence for the exact product/version. Submission accepts only current uploaded/accepted documents that still satisfy the bound requirement's MIME, byte-size, count, and version rules; rejected, superseded, quarantined, and deleted files never satisfy a requirement. Submission records profile, answers, contact/previous-school rows, document manifests, form/declaration/requirement provenance, signer/declaration evidence, and canonical digest as immutable snapshot items.

## Integration requests

1. B6 must dispatch the B0 verified `adm_` webhook envelope to `internal.functions.admissions.payments.fulfilVerifiedEvent`. No other function creates entitlements.
2. The shared provider adapter currently has invoice-shaped metadata. B6 should add an explicit `paymentDomain: "admissions"` metadata field and approved admissions return URL while preserving the reference-based dispatcher.
3. Schema B0 has no conversion output fields for parent/student user IDs or conversion lease; add these only through integration-owner schema work if B3 needs to display them.
4. Guardian email verification evidence must be supplied by the Better Auth integration. B1 denies checkout until `emailVerifiedAt` is present and does not trust client-supplied verification.
