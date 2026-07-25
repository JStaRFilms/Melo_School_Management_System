# B1 Admissions Backend API Contract

B1 exposes tenant- and ownership-checked Convex functions under `functions/admissions/**`. All private IDs are inputs only; list/read output excludes storage IDs and raw document URLs.

## Public bootstrap APIs (B2)

All public bootstrap routes are keyed by `schoolSlug`, optional `intakeSlug`, and opaque public references. They never return Convex document IDs, storage IDs, or signed document URLs.

- `public.getEntry({ schoolSlug, intakeSlug? })` → non-enumerating published programme/intake/offering projection. It returns `unavailable` for unknown, disabled, unpublished, productless, or improperly configured offerings; `closed` and `paused` expose no purchasable offering.
- `public.getPublishedConfiguration({ schoolSlug, intakeSlug? })` → only the selected published form's active typed fields, published document requirements, and latest published declaration. Field and requirement references are stable keys, not IDs. Draft/retired configuration and staff metadata are excluded.
- `public.getGuardianApplication({ schoolSlug, publicReference })` → authenticated owner-only redacted draft/status projection, safe guardian messages, revision/version, and allowed actions. The opaque `publicReference` is school-scoped and is not authority by itself.
- `public.createAttemptForOffering({ schoolSlug, intakeSlug?, idempotencyKey, provider, providerMode })` → server-resolved price/disclosure purchase attempt without a product ID.
- `public.createOrResumeForOffering({ schoolSlug, intakeSlug? })` → reserves/resumes one owned slot and returns only an opaque application reference.
- `public.saveCoreByPublicReference`, `public.saveAnswerByPublicReference`, and `public.submitByPublicReference` accept school slug + opaque application reference. `saveAnswer...` takes a published field key, not a form-field ID.
- `public.createUploadUrlByPublicReference` and `public.bindUploadByPublicReference` take a requirement key, not a requirement ID. The storage ID returned by Convex upload is transient request data only; it must never be placed in a route, list, log, or durable client state.
- `public.initializeAttemptByReference` and `public.verifyReturnByReference` take the opaque `adm_` reference and never return an attempt or entitlement ID. A redirect remains pending until server verification reports `paid`.

## Guardian APIs (B2)

- `guardian.getOrCreateIdentity({})` → `{ guardianId, status, verificationRequired }`. Identity derives from `tokenIdentifier`; B2 must satisfy auth verification before checkout.
- `guardian.listWorkspace({ schoolId, limit? })` → bounded entitlement/application cards.
- `payments.createAttempt({ productId, idempotencyKey, provider, providerMode })` → server-resolved immutable price/disclosure snapshot and `adm_` reference. One key is replay-safe.
- `payments.initializeAttempt({ attemptId })` → `{ state, checkoutUrl }`; `checkout_pending` is not payment success. `payments.verifyReturn({ attemptId })` server-verifies the provider receipt and amount/currency before replay-safe fulfilment.
- `applications.createOrResume({ entitlementId })` → one durable application per entitlement.
- `applications.getDraft({ applicationId })`, `saveCoreSection(...)`, `saveAnswer(...)`, `submit({ applicationId, expectedVersion, signerName, signerRelationship })`.
- `documents.createUploadUrl({ applicationId, requirementId })`, `bindUpload({ applicationId, requirementId, storageId, fileName })`, `getOwnAccess({ documentKey, action })`. B2 must never put storage IDs in a route or persist returned signed URLs.

## Staff APIs (B3)

- `staff.listQueue({ schoolId, intakeId, state?, limit? })` is bounded/redacted and needs `applications.list` for the exact programme/intake.
- `staff.getApplicationDetail({ applicationId })` needs `applications.view_basic`; it is metadata only.
- `staff.getDocumentAccess({ documentKey, action, reason? })` uses `documents.review` for view and `documents.download` for download, writes audit before URL.
- `staff.recordDocumentReview`, `staff.requestChanges`, `staff.recordDecision`, and `conversions.executeAcceptedConversion` enforce scoped capability and legal state.
- `staff.createRetentionJob` creates a dry-run-ready draft only; B1 never auto-deletes admissions records.

## Integration requests

1. B6 must dispatch the B0 verified `adm_` webhook envelope to `internal.functions.admissions.payments.fulfilVerifiedEvent`. No other function creates entitlements.
2. The shared provider adapter currently has invoice-shaped metadata. B6 should add an explicit `paymentDomain: "admissions"` metadata field and approved admissions return URL while preserving the reference-based dispatcher.
3. Schema B0 has no conversion output fields for parent/student user IDs or conversion lease; add these only through integration-owner schema work if B3 needs to display them.
4. Guardian email verification evidence must be supplied by the Better Auth integration. B1 denies checkout until `emailVerifiedAt` is present and does not trust client-supplied verification.
