# OBHIS admissions integration release checklist (B6)

**Status:** release candidate; production publication remains approval-gated.

**Integration order:** `feature/admissions-platform`, then `feature/obhis-public-site`, each as a non-fast-forward merge.

## Integrated contract

- The frozen B0 `ApplicationLinkV1` remains the sole Apply-link DTO. Managed, external, and no-site projections use its exact configured-origin URL; managed `/apply` preserves only bounded `source`/`campaign` attribution and cannot accept a return target.
- Apply routes are `/s/{schoolSlug}` and optional `/s/{schoolSlug}/i/{intakeSlug}`. Paystack receives `paymentDomain: "admissions"` and a school-scoped Apply return URL.
- The shared signed `/webhooks/payment` route resolves the persisted reference first, resolves the school/mode merchant secret, verifies Paystack HMAC, validates successful admissions amount/currency, stores only a body digest, and dispatches to the internal admissions fulfilment mutation. Replays return the original entitlement. Refund/reversal events void the slot and place a durable hold when an application exists. Payment and submission create no student.
- Guardian ownership derives from Convex auth `tokenIdentifier`. Better Auth's verified-email claim is read server-side; no client verification flag is accepted. Legacy Better Auth user IDs remain a read-only bridge as specified by B0.
- Public and preview site projection HTTP endpoints are no-store and fail closed. Preview tokens are hashed, hostname/revision/version-bound, expiring, revocable, and no-index. Publication reads only the immutable published pointer and revalidates evidence/assets. Apply availability therefore changes without a stale application CTA cache.
- Portal links are optional typed projections. A renderer displays only an enabled absolute core-provided link; authenticated membership remains authoritative.
- Accepted conversion remains one ledger/application and writes canonical student/family provenance plus one portal-onboarding outbox row transactionally. A five-minute bounded recovery sweep marks abandoned conversion leases retryable and returns abandoned outbox delivery leases to pending; it never guesses conversion results or creates a student.

## Deployment configuration

Required before enabling a tenant:

1. Configure Convex/Apply auth exactly as the existing Better Auth integration requires, including issuer/audience and verified-email claims.
2. Set `APPLICATION_ORIGIN` (preferred) or `APPLY_APP_ORIGIN` to the HTTPS Apply origin. Production fails closed without it.
3. Set `SITE_PUBLIC_CONTENT_ENDPOINT` to `<CONVEX_SITE_URL>/site-public-projection` and `SITE_PREVIEW_CONTENT_ENDPOINT` to `<CONVEX_SITE_URL>/site-preview-projection`.
4. Configure the school Paystack test/live merchant setting and encrypted active secret. Register `<CONVEX_SITE_URL>/webhooks/payment`; run signed test-mode success, replay, refund, and reversal checks before live cutover.
5. Enable `SITE_TRUST_PROXY=true` only when the edge strips client-supplied forwarded headers. Do not enable forwarded-host trust otherwise.
6. Configure the communication delivery worker/template for `admissions_portal_onboarding`. The repository schedules lease recovery but intentionally does not invent an email provider or send unapproved content.
7. Configure monitoring for webhook 4xx/5xx, `manual_attention`, active finance holds, `failed_retryable` conversions, pending/failed outbox age, unavailable public projections, domain/TLS readiness, and expiring approvals/asset rights.

## Migration and backfill

1. Run `pnpm convex:codegen` against the configured environment, then deploy the additive schema/functions through the normal release pipeline. No generated file is edited manually. B6 could not run codegen because `CONVEX_DEPLOYMENT` was unavailable in the integration workspace.
2. Audit duplicate same-school admission numbers before enabling conversion. Do not auto-merge or renumber.
3. Backfill `users.authTokenIdentifier` only from verified Better Auth identities with a separately reviewed bounded migration; retain the `authId` fallback during observation.
4. Existing schools require no site/admissions row. Create managed profiles through `bootstrapManagedSite`; never seed OBHIS from the removed placeholder.
5. Existing site rows with optional publication/rights fields fail closed until republished through the current lifecycle with accountable evidence.
6. No automatic student provenance, admissions ownership, payment, or site-content backfill is permitted.

## Rollback

- Pause/close the intake or disable application exposure, but leave the `adm_` webhook dispatcher active for delayed money events and replay.
- Revert a site by cloning a prior publication into a new draft and republishing. Never mutate history or point public reads at an unvalidated row.
- Keep payment events, entitlements, snapshots, decisions, conversion ledgers, audits, provenance, and retention holds. Do not delete B0/B1/B4 schema while referenced.
- Disable the managed domain/canonical mapping if public serving must stop; preview remains no-index and must not replace public production.
- Correct a successful conversion through audited canonical operations, never by deleting its ledger.

## Production approval blockers

OBHIS owner/legal/privacy approval is still required for the school identity/display name, domain and DNS owner, contacts/address, programmes and claims, application fee/currency/refund wording, declarations/policies, required documents and sensitive fields, retention windows, portal message copy, logo/photography rights, identifiable-child consent, and every public image. Until recorded as current approval evidence, OBHIS publication must remain blocked.

## Manual UI verification prerequisites

No browser automation was run for B6. After an approved tenant fixture, configured Convex environment, rights-cleared responsive assets, working auth, and Paystack test merchant exist, manually verify:

- managed-site and copied external-site Apply links resolve to the identical canonical route;
- portal CTA visibility/navigation and membership-based authorization;
- guardian signup/email verification, sibling slot purchase, return/pending/success/refund messaging, draft/resume/upload/submit, and no student before accepted conversion;
- staff redacted queue, tenant mismatch denial, private document fresh-auth/access audit, review/decision/waitlist/change-request flows, conversion replay, and onboarding retry;
- publication/application availability changes, preview isolation/no-index, alias redirect, keyboard/focus, 320px reflow, contrast, metadata/robots/sitemap, and production CWV.

## Release evidence

Source-controlled gates are the shared/Convex/Apply/Admin/Sites typechecks and tests, configured lint, Apply/Admin/Sites production builds, frozen-lockfile install, and `git diff --check`. Playwright and deployment are explicitly excluded from this integration run.
