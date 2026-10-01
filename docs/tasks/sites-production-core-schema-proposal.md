# Production school-site schema and contract proposal

Status: approved design record, implemented locally. This is not permission to migrate or operate live infrastructure. Base: merge commit `dd88f551` on `feature/sites-production-core`. The user approved these rules with "Approve and proceed". Actual installed-SDK configuration, supported PNG/JPEG sanitization, direct A/CNAME-only routing, provider-operation reservation and final security corrections are documented in the handoffs and `sites-production-core-readiness.md`; the code samples below preserve the approved proposal rather than replacing those actual contracts. OBHIS is on another machine. Its field IDs, routes and adapter remain unverified pending safe code/doc transfer.

## Decisions

Use the existing `schoolSiteProfiles`, `schoolDomains`, `schoolSiteRevisions`, `schoolSiteAssets`, `schoolApprovalEvidence` and `schoolSiteAuditEvents` tables. Add optional fields to existing tables; add no new tables or capability names. A direct authenticated byte-upload HTTP action can establish storage provenance without a separate ledger, provided it never accepts a pre-existing `_storage` ID. Reuse the existing site field union and `ApplicationLinkV1`. Keep a single Vercel integration, not a generic provider framework. The existing static Sites catalogue is published demo configuration, never a live Admin or private Convex source.

The hardest boundary is TLS. Vercel's domain `verified` and config `misconfigured: false` do not prove that a client can establish a valid HTTPS connection. A certificate listing does not prove that Vercel is serving that certificate for the hostname. Activation therefore requires an independently validated live TLS handshake and a deployment-owned HTTPS probe as well as a fresh project-domain/config observation. If those checks cannot be implemented safely in the deployed probe environment, domain activation waits. There is no invented `tlsActive` Vercel property.

## Exact additive schema delta

The following are additions to the existing table object validators in `packages/convex/schema.ts`, not replacements. Existing required columns, validators, indexes and table names stay unchanged. No new indexes are needed: domains use `by_hostname` and `by_school`, assets use `by_storage`, evidence uses `by_school_and_subject_type_and_subject_key`. Check `.unique()` results and reject historical duplicate rows. Bound all collection reads and payload sizes.

```ts
// schoolDomains, alongside existing verificationTokenHash/status/etc.
verificationRecordName: v.optional(v.string()), // code-owned _school-site-verify.<hostname> TXT owner
verificationRecordValue: v.optional(v.string()), // random opaque value, operator-only display
verificationIssuedAt: v.optional(v.number()),
verificationExpiresAt: v.optional(v.number()),
verificationGeneration: v.optional(v.number()), // increments on rotate, suspend, retire, reassignment and new check cycle
ownershipObservation: v.optional(v.object({
  generation: v.number(),
  tokenHash: v.string(),
  observedAt: v.number(),
})),
providerRoutingObservation: v.optional(v.object({
  generation: v.number(),
  observedAt: v.number(),
  projectId: v.string(),
  projectDomainVerified: v.boolean(),
  configuredBy: v.union(v.literal("A"), v.literal("CNAME"), v.literal("dns-01"), v.literal("http"), v.null()),
  misconfigured: v.boolean(),
  // Server checks exact name, projectId, production target and no gitBranch,
  // customEnvironmentId or redirect before writing an observation.
})),
tlsObservation: v.optional(v.object({
  generation: v.number(),
  observedAt: v.number(),
  leafFingerprintSha256: v.string(),
  leafNotAfter: v.number(),
  deploymentProbeMatched: v.boolean(),
})),

// schoolSiteAssets, alongside existing rightsStatus/approvalEvidenceId/etc.
childApplicability: v.optional(v.union(
  v.literal("no_children"), v.literal("contains_children"), v.literal("unknown")
)),
childConsentEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
uploadProvenance: v.optional(v.literal("website_direct_upload_v1")),

// schoolSiteAuditEvents, alongside existing actorUserId/eventType/etc.
actorPlatformAdminId: v.optional(v.id("platformAdmins")),
// Extend eventType's current v.union(...) with:
// v.literal("asset_uploaded"), v.literal("evidence_recorded")
```

`verificationTokenHash` already exists; never replace it with Vercel's ownership challenge. The random TXT value is public DNS data, but `verificationRecordValue` is returned only to the authorized domain-requester/operator until expiration. Create a cryptographically random value with at least 128 bits of entropy; bind the TXT name/value to the normalized hostname and generation, and store its SHA-256 hash. The school can re-read the current instructions after a reload, rotate the challenge, and recheck DNS. Rotation clears all three observations and changes the hash/generation. An expired challenge cannot be resurrected by an old asynchronous result. Keep revoked/retired hostnames reserved in `by_hostname` unless a separately reviewed transfer releases them. The Vercel-issued `verification` challenges are distinct operator diagnostics; a successful Vercel verification cannot substitute for our own TXT observation.

The first website-only upload stores the bytes and inserts an asset with `uploadProvenance: "website_direct_upload_v1"`. Legacy/missing provenance assets fail public admission. No migration assumes an existing image is website-owned. `childApplicability` is required for every image, including logo, favicon and social-share image: missing/`unknown` denies publication and public bytes. `contains_children` requires current, same-school, asset-and-checksum-bound child consent evidence in `childConsentEvidenceId`; `no_children` requires a recorded review assertion, not a browser default. Existing `approvalEvidenceId` remains the independent rights/review approval. Every public asset still needs approved unexpired rights and a current, matching rights evidence record. For documents, reject unsupported/active content; any image preview/thumbnail is independently subject to the image policy. Do not add nullable child fields to a public DTO.

`schoolApprovalEvidence` already has `approvalClass`, `subjectType`, `subjectKey`, `evidenceReference`, actor, approval time, expiry and revocation. No schema change is needed if the website approval workflow restricts these fields server-side. Site evidence uses only these exact subject formats, generated by the server, never a free-form `subjectKey` from an approver:

- `subjectType: "site_content"`, `subjectKey: "v1:<rendererKey>:<schemaVersion>:<fieldId>:<sha256(canonical typed field value)>"` for an identity, sensitive-public or other approved fact. The manifest fixes the field's required evidence classes. Changing that field's value invalidates its approval without requiring approval of unrelated text. For a fact approved only as a complete publication, use `subjectType: "site_revision"`, `subjectKey: "v1:<rendererKey>:<schemaVersion>:<contentDigest>"` instead. `contentDigest` hashes canonical validated `content` including `routeSeo` and ordered asset IDs/checksums; build the digest server-side. Do not approve a mutable draft ID by itself.
- `subjectType: "site_asset_rights"` or `"site_asset_child_consent"`, `subjectKey: "v1:<assetId>:<storageSha256>"`. `storageSha256` comes from the storage metadata checked against existing `checksum`, not client input. Child applicability assertion uses `subjectType: "site_asset_child_applicability"` and the same key, with an evidence reference recording the approved `no_children` or `contains_children` classification.

For sensitive facts, identity and child media, the operator/school approver selects a currently validated, immutable approval candidate view showing rendered value, digest, referenced asset identifiers/checksums and evidence class, then supplies a bounded source/reference, expiry and explicit confirmation. The server recomputes the candidate and key in the evidence-creation mutation, checks same-school subject, and writes an append-only evidence row. Revocation uses existing `revokedAt`; correction creates a new evidence row. No public generic evidence-creation endpoint accepts arbitrary subject/class. School content approvers require active same-school membership and an explicit school-scoped `privacy.approve` grant for privacy/child/sensitive-public evidence; platform-admin status alone cannot approve school facts. Platform operators may provision profiles/domains but not bypass school content approval. Identity evidence has the same independent approver rule, with a verified source reference and school-reviewed identity values. Require identity evidence for the displayed school name and every identity-class field in all managed public manifests; no profile toggle and no assumption that membership proves identity. Publishers need `site.publish.standard` or `site.publish.sensitive` as applicable, separately from evidence creation. `site.publish.sensitive` is not an approval grant. Draft saves use the existing `settings.manage`; previews use `site.preview`; revert uses `site.revert`; requests use `site.domain.request`. All are explicit school-wide grants, never programme/intake-scoped grants.

`schoolSiteAuditEvents.actorPlatformAdminId` records the actual active platform admin for operator actions. School actions use `actorUserId`; exactly one actor ID for human events. Write a bounded safe summary and outcome for approvals, uploads, publication, checks, challenge rotation, activation, suspension and retirement. Do not log raw TXT tokens, evidence documents, file bytes or provider credentials. Operator-only provider checks can use existing `domain_changed` with a narrow summary. `previewed` must not log every asset fetch. Provider network failures cannot create a success audit event.

## Environment declaration and configuration

Propose this additive `packages/convex/convex.config.ts` change when implementation starts, using `defineApp({ env: ... })` and importing `env` from `_generated/server` inside Convex functions. Runtime production validation requires nonempty, correctly shaped values. Do not declare platform-provided `CONVEX_SITE_URL` or `CONVEX_CLOUD_URL`.

```ts
// Proposed defineApp options; no values here.
env: {
  SITES_VERCEL_PROJECT_ID: v.optional(v.string()), // deployment-owned public identifier
  SITES_VERCEL_TEAM_ID: v.optional(v.string()), // deployment-owned public identifier, if team-scoped
  SITES_VERCEL_API_TOKEN: v.optional(v.string()), // server-side secret, never NEXT_PUBLIC
}
```

Production provider checks refuse to run when required configuration is missing; `teamId` is required if the project belongs to a team. The project ID and team ID can stay placeholders in *mocked development only*, where no network calls or activation outside synthetic fixtures occur. Real previews/live checks require the actual deployment-owned IDs and a private token supplied through the approved secret store. Do not copy environment files or log values. Application links keep the existing deployment-owned `APPLICATION_ORIGIN`/`APPLY_APP_ORIGIN`; neither site content nor Host may set them. No portal-origin setting is proposed yet. Portal intent returns unavailable until a portal exists and a reviewed deployment-owned destination and school availability rule are configured. No anonymous share-link or token-preview environment variable is needed.

## Vercel checks and activation

Source for provider fields: `/tmp/sites-production-vercel-api.json`, fetched without credentials from `https://openapi.vercel.sh`. `GET /v9/projects/{idOrName}/domains/{domain}` returns `name`, `projectId`, `verified`, optional `verification`, `gitBranch`, `customEnvironmentId`, `redirect` and `redirectStatusCode`. `GET /v9/projects/{idOrName}/domains?production=true` offers a paginated production-only project-domain list; check the exact hostname in that list, fail closed on incomplete pagination/ambiguous matches. The single-domain GET does not itself assert the target. `GET /v6/domains/{domain}/config` returns `configuredBy`, `misconfigured`, ranked `recommendedCNAME` and `recommendedIPv4` plus accepted challenges. `GET /v8/certs` returns paginated `certs` with `cns`, `createdAt`, `expiresAt`, `id`, `autoRenew`; `GET /v8/certs/{id}` returns the same certificate metadata. None returns a TLS-live boolean. `POST /v10/projects/{idOrName}/domains` and `POST /v9/projects/{idOrName}/domains/{domain}/verify` are **live mutations**. Only an authenticated platform operator may explicitly initiate them in a separately authorized operational workflow. Merely viewing or checking status must not call POST. No live provider calls with credentials are part of this proposal.

For each normalized requested hostname, the school supplies the independent TXT proof; a server-side authoritative DNS read records `ownershipObservation` only for an exact, unexpired TXT value. A platform operator may then attach the exact hostname to the configured production Vercel project, explicitly verify Vercel's separate challenges as needed, and request a read-only readiness check. Check that project-domain `name` and `projectId` match the requested hostname and configured project and that the same exact name appears in the production-filtered project list; `verified === true`, `gitBranch == null`, `customEnvironmentId == null`, `redirect == null`; reject unexpected preview/branch/environment assignments. Config must have `misconfigured === false` and `configuredBy` indicating actual serving route (`A`, `CNAME` or an independently proved proxy `http`), not `null` or `dns-01` alone. Show the ranked records supplied by Vercel to DNS owners; never invent an IP or assume `rank: 1` is already installed. Confirm traffic reaches the right deployment using a code-owned HTTPS probe response containing a deployment-owned fixed marker, not editable tenant content.

In a controlled Node runtime, connect with SNI for the exact hostname, validate the full trust chain, hostname/SAN, and certificate validity against the server clock. Probe HTTPS with redirect following disabled and a fixed path; check the deployment marker and public network destination. Resolve DNS and reject any private, loopback, link-local, metadata or otherwise reserved address on every candidate address and connection; bound redirects (zero), response bytes and timeouts. Prevent DNS rebinding by pinning/checking the resolved connection address. This probe is platform-controlled, never an arbitrary host or path supplied by a public caller. A Vercel cert listing may help diagnose pending issuance, but cannot establish live readiness. Store only validated handshake fingerprint, expiry and timestamp; do not manufacture a certificate ID or treat `autoRenew` as current availability.

A check action takes no caller-provided observation or timestamp. It captures the domain ID, normalized hostname, generation and challenge hash; it fetches external evidence; an internal transactional mutation re-reads the domain and active operator, rejects any mismatch, rotated/expired proof, suspended/retired state or wrong project, and commits observations with server timestamps. Checks from different generations never compose. Activation is one operator-authorized mutation: re-read active school, managed published profile and exact renderer/schema, current published revision/assets/evidence, candidate domain and all observations. Require each observation to match the same generation/hostname and current token hash, be within the code-owned short activation window (proposed 15 minutes), have TXT proof unexpired, and TLS leaf validity beyond a safety margin (proposed 24 hours). Recheck same-school canonical reference and enforce at most one active canonical record and one `profile.canonicalDomainId` transactionally. Active alias `canonicalDomainId` must point to that school's active canonical host. Record the operator and transition in the same transaction. Clear observations and increment generation on suspension/retirement/rotation. Scheduled read-only rechecks with transactional invalidation or a server-timed public gate must deny stale ownership/routing/TLS observations; do not use query `Date.now()` or a browser-supplied `now` for readiness. Favor an uncached first-party action at public ingress and no-store responses. Materializing expiry in scheduled mutations is an alternative only if late jobs fail closed at the actual time bound. Checks/activation never themselves publish school content. No provider delete/move/DNS/issuance mutation is in scope.

## Shared publication manifest and public contract

Add one pure TypeScript manifest module at `packages/shared/src/site-manifests.ts`, exported as `@school/shared/site-manifests` in `packages/shared/package.json`. Its imports must not transitively pull in React, Node provider credentials or private fixtures. Convex validation and the compiled Sites registry import the same exact-key/version descriptors; fail closed if either build cannot import them. A descriptor has `rendererKey`, `schemaVersion`, finite field definitions (`fieldId`, existing field kind, required flag, length/list bounds, evidence classes), fixed route IDs and paths, optional asset slots and SEO constraints. Validate duplicate/unknown field IDs and route IDs, all size limits, safe parsed rich-text AST where allowed, valid intent variants and same-school asset references. Route paths and arbitrary URLs are code-owned, not content. Digest canonical typed values after successful validation. Suggested test renderer is `school-core-synthetic-v1` with exact version `1`, routes `/`, `/about`, `/contact`, semantic fields `school_name` (identity evidence), `intro` (bounded text) and optional `hero_image` (asset_ref). It is a testable managed renderer, **not** an OBHIS fallback or registration of `obhis-v1`.

Public loader: server-only action, `resolvePublicSite({ hostname, routeId })`, called by a trusted first-party route using its normalized actual Host, not `X-Forwarded-Host` or `X-Forwarded-Proto`. Site access configuration must accept only requests received through the configured deployment ingress; no public caller-supplied hostname may authorize private resources. The lookup checks an active host, same-school active canonical/alias, active school, managed published profile, immutable `publishedRevisionId`, exact manifest key/version, server-time current approvals, domains and assets. On any mismatch return `{ status: "unavailable" }` with no tenant details and no indexable page. No public query may derive expiry from `Date.now()`; actions/mutations can use server time. Queries for stable metadata are fine only behind a server-timed gate. Use no-store on availability-dependent responses. The static legacy demo allowlist remains separate, explicit, and excludes fabricated OBHIS.

Proposed external projection, versioned and whitelisted, never a `Doc` or storage URL:

```ts
type PublicSiteV1 = {
  version: "1";
  schoolSlug: string;
  rendererKey: string;
  rendererSchemaVersion: string;
  revisionId: string; // opaque publication id, no draft
  publishedAt: number;
  canonicalOrigin: string; // https://<approved active canonical hostname>
  activeHostname: string;
  redirectToCanonical: boolean;
  routeIds: readonly string[]; // exact manifest allowlist
  fields: readonly { fieldId: string; value: PublicFieldValueV1 }[];
  routeSeo: readonly { routeId: string; title?: string; description?: string; shareAsset?: PublicAssetV1 }[];
  applicationLink: ApplicationLinkV1;
  portal: { availability: "unavailable" } | { availability: "available"; href: string };
};
type PublicAssetV1 = {
  id: string; // opaque site-asset ID only; never _storage ID
  src: string; // first-party /api/site-assets/<opaque id> endpoint
  kind: "logo" | "favicon" | "hero" | "gallery" | "staff" | "facility" | "document" | "social_share";
  altText?: string;
  decorative: boolean;
};
type PublicFieldValueV1 =
  | { kind: "text" | "rich_text"; value: string } // rich_text is validated AST serialization, not HTML
  | { kind: "boolean"; value: boolean }
  | { kind: "string_list"; value: readonly string[] }
  | { kind: "asset_ref"; asset: PublicAssetV1 }
  | { kind: "link_intent"; intent: "admissions_info" | "application" | "portal" | "contact" | "visit" | "reviewed_external"; href: string | null };
```

Construct and freeze a read-only renderer context from this projection. Do not pass evidence references, claims, uploaded bytes, arbitrary URLs, internals or persistence clients. The `applicationLink` uses the existing `ApplicationLinkV1` resolver's `href` and availability, preserving `/s/{schoolSlug}` and optional `/i/{intakeSlug}`; adapt that resolver to a server-timed internal path if needed, without a caller-controlled clock or divergent public DTO. `/apply` redirects only when the current link is available. Otherwise fail closed. Portal remains unavailable without approved deployment configuration. SEO canonical is HTTPS from the stored approved canonical host, not forwarded protocol. Alias 308 redirects retain only validated manifest paths and safe query parameters, never an open redirect. Preview is separate, authenticated, same-school, watermarked, noindex/nofollow, no canonical/sitemap, and substitutes placeholders for pending assets. There are no anonymous preview tokens or share links.

Approved asset bytes use a first-party `/api/site-assets/<opaque id>` proxy: its server-side gate checks active host and school, published revision references, storage provenance, exact rights and consent evidence, unexpired times, media type and status **again** at request time. The internal Convex HTTP action streams bytes or returns an ephemeral upstream URL only to the trusted site server; that server fetches and proxies bytes with no-store, never redirects the browser to `ctx.storage.getUrl()` or emits its URL/ID. No public upstream storage URL, cache reuse across tenants or direct admissions/student image reference. For performance, no-store first; later caching needs a bound below all applicable expiry times and immediate suspension/revocation invalidation.

## Function inventory and operator path

- Public entry: `sites.public.resolvePublicSite` is an action for server-time gating; internal transactional reads assemble the DTO. `sites.public.resolveAssetAccess` is an internal server-only action/mutation gate for the byte proxy. Neither takes a client `now` or approves a supplied school ID on trust.
- Authenticated school operations: `sites.content.saveDraft` (bounded and expected version), `validateDraft`, `previewDraft` (server-time capability check), `publishDraft` (single transaction creates immutable publication and updates profile pointer), `revertToDraft` (clone and revalidate), `sites.evidence.approveCandidate`/`revokeEvidence`, `sites.domains.requestDomain`/`rotateChallenge`/`getInstructions`. Each checks school ownership, active membership, exact school-scoped grant and current time. An active school admin or member is not an implicit publisher.
- Upload: authenticated `POST` Convex HTTP action at an exact registered path, with bounded body, direct server-controlled `ctx.storage.store`, content signature/MIME/size validation and server-only registration. The registration mutation rechecks authenticated school-wide capability and storage metadata; action cleans up the new blob if admission fails. No `registerAsset(storageId)` exposed to browser clients, no reuse of admissions or student storage IDs. If the selected deployment cannot propagate a trustworthy authenticated identity through the action and internal registration, add a short-lived one-use server-issued upload reservation ledger **then**, rather than accepting arbitrary IDs.
- Platform operations: existing `getAuthenticatedPlatformAdmin` identity pattern for `provisionProfile`, `checkOwnershipAndProvider` (read-only external action), `attachDomain`/`verifyProviderDomain` (explicit separately confirmed live POST actions), `activateDomain`, `suspendDomain`, `retireDomain`. Platform authentication is resolved server-side, and transactions recheck active operator status. Operator can choose renderer key/version from code-owned manifests but cannot set school public text or approve child rights. Display check times, failures, Vercel recommendations and TXT instructions without claiming that provider status equals TLS readiness.

Activation and publication are separate. Provision profile, save draft, upload and review assets, create bound evidence, validate, preview, publish, request and verify domain, attach provider domain with explicit permission, check real routing/TLS, approve cutover, then activate. Suspension blocks pages, redirects, SEO and bytes immediately. Revert produces a draft, never points at old content without reapproval.

## Verification and handoff

Before schema work, confirm the following approval choices: strict identity evidence for all managed sites; independent `privacy.approve` reviewers and how school-approved source references are held; the `no_children` reviewer policy and consent expiry; Vercel project/team and credential owner; DNS owner and an operator for explicit add/verify/activation; a trusted ingress and deployment-owned probe marker. Project/team IDs may remain mocked-development placeholders. OBHIS exact manifest and imagery decisions wait for its private worktree and safe code/docs transfer, excluding private images.

Builder should first read `packages/convex/_generated/ai/guidelines.md`, `docs/features/AdmissionsAndSiteFoundationContract.md`, this proposal, `packages/convex/schema.ts` at the six site tables, `functions/foundation/auth.ts`, `functions/foundation/applicationLinks.ts`, `functions/foundation/contracts.ts`, and the Vercel OpenAPI extract. Export the pure manifest before implementing publication; add optional schema columns in a reviewed change and regenerate types afterward.

Acceptance tests use synthetic schools, mock Vercel/DNS and controlled TLS/probe evidence. Cover blank legacy optional fields denying readiness and child images; arbitrary `_storage` IDs failing registration; digest/asset substitution after evidence approval; expired/revoked evidence/rights/consent; a separate school approving or publishing another school's material; school admin without school-wide grants; stale public callers passing fake `now`; challenge rotation and late checks; mismatched Vercel project/environment/redirect; config false positives and cert-list-only TLS claims; cert expiry, hostname/SAN failure, private-address DNS and probe mismatch; unique canonical host and alias; suspension before byte retrieval; unavailable application and portal links; no signed storage URLs in DTOs/redirects; and no OBHIS private image in production bundles. Verify focused shared/Convex/Sites tests and typechecks on implementation. If school-facing colours are touched, run `node scripts/audit-theme-colors.mjs` and classify results. No runtime code, seeds, deployments, installs, commits, provider mutations or DNS changes are authorized by this artifact.
