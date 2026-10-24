# Managed site upkeep and branding

## Goal

Keep unchanged, authorized school websites online without artificial monthly approval or TXT rotation work. Make the existing Sites page usable with separate editor, reviewer and publisher capabilities. Use the school's published logo as its website icon by default and allow a separate website icon.

The owner authorized this work and reviewed Production rollout in this conversation. This does not authorize invented consent, weakening actual revocation or expiry, payment/application activation, Preview changes or unrelated school data changes.

## Approval lifetime

Sites approvals may be dated or explicitly valid until revoked. Keep the existing optional `expiresAt` field for dated approvals and add a Sites-specific optional `validity: until_revoked` marker. Absence of both remains invalid. Contradictory markers/dates, nonfinite dates, past dates and dates beyond the existing maximum remain invalid.

Until-revoked approval is a deliberate reviewer choice, not a reinterpretation of old records. Capture whether the reviewer used owner attestation or reviewed documentation. Do not claim signed parental consent was inspected when the real source is the owner's school/parent authorization relayed in this conversation. A source with an actual end date must use dated approval.

Keep old approvals immutable. A real independent reviewer records replacements for exact current values and immutable image checksums. Select the latest matching field approval so a new publication records the replacements. Do not let an older approval silently revive after a newer applicable approval is revoked or expires. Preserve publisher independence, exact rights/consent pointers and latest child-classification semantics. Replacing rights with an until-revoked approval clears the asset's old finite rights deadline; the referenced evidence must still validate.

The current live revision remains immutable. After replacement review, publish the identical intended draft through the supported version-checked workflow. Do not patch published evidence IDs or mutate approval rows directly.

## Domain ownership

Add an explicit `ownershipProofPolicy: persistent_authoritative_v1` policy for persistent TXT proofs. Existing unmarked domains keep their finite challenge behaviour until deliberately transitioned. An authenticated platform operator may adopt persistent ownership for an exact confirmed hostname only while the old proof and fresh ownership/routing/TLS/marker observations are valid. Preserve its TXT value, generation and active routing. Reject expired legacy proofs, provider-operation locks, suspension and retirement.

New requests and explicit rotations use persistent proof policy. Keep the TXT record installed. The existing five-minute maintenance path must continue checking authoritative TXT, exact provider project assignment, HTTPS certificate validity and the deployment marker. The fifteen-minute observation gate remains fail-closed. There are no automatic provider writes or automatic activations. Missing DNS, stale checks, invalid TLS, suspension or retirement must still deny public pages, redirects and asset bytes.

Explicit rotation remains a security operation: change token/generation, clear observations, interrupt traffic, require new DNS proof and operator activation. UI copy must distinguish this from routine automatic rechecking. Legacy deadlines remain visible only for legacy finite proofs.

## Private management UI

Expose actual effective capabilities independently: editing, preview, review, publication, reversion and domain requests. Retain existing bounded private read projections for authorized roles. `canEdit` must mean editing permission rather than any Sites read access. Backend authorization remains authoritative.

Reviewers see candidate/source/lifetime/approval controls without editor or publisher actions. Publishers see the saved draft, validation and publication without content editing. Editors retain save/upload/asset selection and authorized preview. Revert and domain controls require their own grants. Explain access limitations rather than displaying actions guaranteed to fail.

Use the existing Admin styles and controls. Keep image/source statements truthful. Rich visual review previews tracked separately in issue 131 need not become a full redesign in this change.

## Website icon and Admin logo

The default favicon and Apple/home-screen icon come from the published `school_logo` asset. An optional `site_favicon` asset reference of kind `favicon` overrides it. Add it as a backward-compatible optional renderer field, not a new required field or a live Admin source. Use the same published asset gates, digest, school ownership, review and public asset proxy as other website images.

An editor may explicitly copy the selected school's Admin logo into the private website draft through the authenticated branding read and existing website byte-upload proxy. Verify the returned school ID, limit/validate the bytes and preserve the website upload provenance. PNG/JPEG may pass through; if WebP conversion is required, bound decoded dimensions before producing PNG. Do not reuse an Admin storage ID or signed URL in the published website. The copied asset still requires website review and publication. Never silently synchronize an Admin branding save to a live site.

Use published tenant config for icon metadata and manifest icons. Remove the shared static icon route if it would override tenant metadata. Do not change the Admin navigation icon, add offline/PWA behaviour, or invent new SEO features.

## Data flow and components

- Shared approval/domain schema receives additive optional policy/provenance markers; existing rows remain readable.
- Sites approval API validates explicit lifetime/provenance, writes new evidence and updates exact private asset pointers.
- Publication and public asset/page gates use the same evidence validity checks.
- Domain readiness and snapshots use the same persistent-versus-legacy proof validity rule; maintenance retains its existing external checks.
- Private management returns capability-specific flags and clear lifetime/policy state.
- Admin edits only private drafts. Sites metadata and manifest resolve published host-bound assets.

## Implemented interfaces and compatibility

`functions/sites/evidence:approveCandidate` keeps the existing candidate union and `confirmed` flag. An explicit indefinite request supplies `validity: "until_revoked"`, `sourceKind: "owner_attestation" | "document_review"` and no `expiresAt`. Dated requests supply finite future `expiresAt` within 366 days and no validity marker. Source kind remains optional for legacy finite callers. Evidence rows and asset rights deadlines are never inferred to be indefinite from an absent date alone.

`functions/sites/domains:adoptPersistentOwnership({domainId, confirmation})` requires the exact string `CONFIRM PERSISTENT <stored hostname>`, active platform authentication and passing `ready()` observations while the legacy proof is still valid. It removes only the old finite deadline, sets the persistent policy and appends the operator audit event. Requests and explicit rotation return `expiresAt: null`; private views preserve finite legacy dates.

Management exposes `canEdit`, `canReview`, `canPublish`, `canPublishSensitive`, `canPreview`, `canRevert` and `canRequestDomain`. Read-only saved content remains available to existing authorized read roles. Publication-gate checks accept a publisher without requiring a preview or edit grant and check sensitive permission when needed.

The optional `site_favicon` field is registered for renderer schema version 1 without changing old content or its digest. Admin's asset selector follows every registered asset field and kind. Logo copy uses the selected-school authenticated branding query on an explicit click, validates the returned school ID, bounds downloaded bytes to 5 MB and WebP pixels to four million, then uses the existing authenticated website upload endpoint. The backend independently sanitizes PNG/JPEG bytes. Copying does not save the draft, create evidence or publish.

Deploy schema/backend before the capability-specific UI. Deploy the matching Sites optional manifest and tenant metadata together. No remote codegen or data rewrite is part of this implementation. Older backend code will reject indefinite records, so rollback must account for any subsequent real reviewer replacements and domain adoptions. See the [operator guide](../tasks/sites-production-core-operations.md) for the supported operational calls.

## Verification and release

Test explicit indefinite approval, invalid incomplete records, genuine expiry, revocation, newest replacement selection, independent identities, asset checksums and immutable publication history. Test persistent proofs beyond thirty days with fresh observations, legacy expiry rejection, exact-host adoption, locked operations, rotation races and failed maintenance. Cover capability-specific UI and favicon default/override/tenant isolation with old draft compatibility.

Run focused tests, relevant typechecks/lint, schema coverage and the informational tenant-colour audit. Read-only independent review precedes exact-target release. Deploy only Production `outgoing-warbler-782`; Preview and Development are excluded. Record truthful replacement approvals with the real reviewer and re-publish through the real lead. Adopt persistent ownership on only Olive's two existing domains. Verify scheduled maintenance, live favicon/manifest, redirects, image checksums and private-route denial. Do not retry quota failures or uncertain external writes.
