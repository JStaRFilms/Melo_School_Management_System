# Admissions and Site Foundation Contract (B0)

**Status:** frozen shared contract for B1–B5.  
**Compatibility:** additive only; existing schools have no admissions or site profile by default.

## Public and tenant boundaries

- `ApplicationLinkV1` is the only public application-link DTO: `{ version: "1", schoolSlug, href, availability, intakeSlug, opensAt, closesAt }`.
- The configured application origin plus `/s/{schoolSlug}` is canonical. An intake may use `/s/{schoolSlug}/i/{intakeSlug}`. No caller, content record, hostname, or redirect parameter supplies an origin.
- Unknown, inactive, incomplete, or unavailable offerings return the same `availability: "unavailable"` projection; they do not disclose private configuration.
- Internal resolver context (school ID/payment domain) is distinct from `ApplicationLinkV1` and is never a competing public DTO.
- Existing schools remain valid with no `schoolSiteProfiles` row. A missing profile means no managed public site, not a generic fallback site.

## B0 decisions closed

1. **One public link:** `ApplicationLinkV1` is implemented in `@school/shared` and `functions/foundation/applicationLinks.ts`; route and availability are explicit rather than request-host guessed.
2. **Waitlist projection:** application state has a distinct `waitlisted` state. It is not `decisioned` and is not converted. A decision row may be `accepted`, `rejected`, or `waitlisted`; only `accepted` can enter conversion.
3. **Capabilities and approvals:** `schoolCapabilityGrants` is the sole grant record with school/programme/intake scope, grantor, reason, expiry, revocation, and break-glass flag. Default deny applies, including platform support. A grantor must have an active same-school `grants.manage` grant, may grant only capabilities and scopes contained by their own active grants, and can never create, extend, or revoke their own grant. Break-glass is a separately provisioned, scoped, expiring grant with a required reason and audit; it cannot be used to create a standing grant. B0 does not make school-admin status an implicit sensitive capability. `schoolApprovalEvidence` is independent from the actor who publishes. Privacy/legal/finance evidence may be attached to a publication without requiring one actor to hold both approval and publishing capabilities.
4. **Checked document access:** lists are metadata-only. `issueCheckedDocumentAccessV1` checks school scope, explicit caller authorization, quarantine/deletion state, and fresh-auth assurance when requested; it writes the audit row before it obtains an ephemeral signed URL. It never returns a storage ID and denies with the same `unavailable` shape.
5. **Immutable publication:** `schoolSiteRevisions` separates mutable drafts from immutable publications. The profile's `publishedRevisionId` is the only public pointer. Draft writes carry `expectedDraftVersion`; publishing creates a new revision after renderer/content/assets/evidence validation; reversion clones an old revision into a new draft. Historical publication and submission rows are never edited.
6. **Foundation risks:** `AuthIdentityV1` uses `tokenIdentifier` with a read-only Better Auth `authId` fallback; it returns zero-to-many active memberships. `adm_` references dispatch to an admissions replay ledger, while existing references dispatch to billing. Student admission-number lookup, source-application uniqueness, and application-photo provenance/retention-hold fields are additive.
7. **Typed intents:** site content accepts only `admissions_info`, `application`, `portal`, `contact`, `visit`, and `reviewed_external`. Application/portal links resolve server-side. A reviewed external link refers to a reviewed record ID; no editable origin, arbitrary URL, script, iframe, or open redirect exists in the contract.
8. **Public identity gate:** `schoolApprovalEvidence.approvalClass = "identity"` explicitly supports a stricter school-level policy. A renderer may publish identity fields only when the profile/publication policy requires and finds unexpired identity evidence. This preserves the OBHIS launch gate even where ordinary display names use standard confirmation.

## Authorization, auth, and private data

`AuthIdentityV1` is server-derived from `ctx.auth.getUserIdentity().tokenIdentifier`. New membership records write `users.authTokenIdentifier`; legacy `users.authId` remains a temporary Better Auth user-ID bridge until a reviewed backfill. The membership resolver never assumes a user has one school membership.

Capability grants are only a projection/gating primitive. B1/B3/B4 must additionally check object school scope and programme/intake scope for every operation. Expired/revoked grants and archived memberships are denied. Break-glass requires a scoped, expiring, reasoned, audited grant and does not grant a permanent role.

Admissions documents are separate from public site assets. They use opaque document keys and private storage references. Quarantined files are never available through ordinary access. Public site assets require approved, non-expired rights evidence; an admissions document cannot be selected as a site asset.

## Workflow, payment, and conversion contracts

- One product has `slotCount = 1`; server-resolved price/disclosure is immutable once an attempt is created.
- `PaymentReferenceV1` reserves the `adm_` namespace. Dispatch resolves a persisted purchase/billing attempt, then validates the school/provider/mode before fulfillment.
- Admission webhook envelopes deduplicate on `(schoolId, provider, providerEventId)` and retain a digest rather than raw webhook body. B1 alone converts a verified event into an entitlement; redirect or webhook receipt never creates a student.
- Entitlement/application/snapshot/decision/conversion records are school-scoped. A submitted snapshot and its items have no update path.
- `students.by_school_and_admission_number` supports conversion conflict checks. `students.sourceApplicationId`, photo provenance, source-document, and retention-hold fields preserve an accepted application photo without copying unrelated sensitive data. Conversion remains a B1 idempotent ledger transaction.

## Structured-site boundary

A managed site profile has mode (`managed|external|none`), renderer key/schema version, domain and revision pointers. Domains are normalized records with lifecycle and canonical intent; hostname uniqueness and a single active canonical domain are transactionally enforced by B4.

`schoolSiteRevisions.content` contains only bounded typed semantic fields and route SEO projections. It cannot contain arbitrary HTML, CSS, JavaScript, remote module paths, renderer selection, route placement, or application origins. Renderer descriptors remain code allowlisted.

## Migration and rollout

1. Deploy the additive schema and generated bindings first. No field is required on existing `users` or `students`; no site or admissions row is required for an existing school.
2. Set `APPLICATION_ORIGIN`/`APPLY_APP_ORIGIN` in production before exposing any link. Production intentionally fails closed if neither is configured.
3. Backfill `users.authTokenIdentifier` only from verified Better Auth identities in a separately reviewed, bounded migration. Until then, the resolver uses its read-only `authId` fallback.
4. B1 creates admissions records only from the frozen validators. B4 creates a site profile/revision only through its publish workflow; it must not seed OBHIS from legacy/demo content.
5. Before a production webhook cutover, configure the shared route with the same merchant secret source and run replay tests for both an existing billing reference and an `adm_` reference.
6. Do not backfill student provenance or admission source automatically. Record it only during an explicit reviewed conversion or correction.

## Rollback

- Disable new checkout/link exposure by pausing/closing an intake or disabling the application surface; keep the `adm_` dispatcher live so delayed verified webhooks are recorded and replay-safe.
- Revert public content by cloning a previous revision into a new draft and republishing; never point public reads at an unvalidated historical record or mutate its content.
- Do not remove B0 tables/fields while payment events, snapshots, document audits, conversion provenance, or published revisions reference them. Use retention/export policy for later removal.
- Existing billing and school records remain on their current contracts. The B0 schema is additive and requires no destructive rollback or data rewrite.

## Required validation

- Shared link/reference tests: `pnpm --filter @school/shared test`
- Convex contract tests: `pnpm --filter @school/convex test`
- Type checks: `pnpm --filter @school/shared typecheck && pnpm --filter @school/convex typecheck`

B1 owns admissions lifecycle behavior; B4 owns site publication/domain behavior. Neither branch should edit shared schema, generated bindings, or the contracts above without integration-owner approval.
