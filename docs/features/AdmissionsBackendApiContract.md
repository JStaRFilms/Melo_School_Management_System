# B1 Admissions Backend API Contract

B1 exposes tenant- and ownership-checked Convex functions under `functions/admissions/**`. All private IDs are inputs only; list/read output excludes storage IDs and raw document URLs.

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
