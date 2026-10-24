# Managed Sites upkeep and branding

## Scope and limits

Use [the upkeep contract](../../../../docs/features/ManagedSiteUpkeepAndBranding.md). The standard QA cohort does not attest Platform or public Sites. Do not reset QA, use Preview or substitute real school approvals for synthetic evidence. A separate approved fixture and release workflow is required for live acceptance.

Local evidence comes from `functions/sites/*.test.ts`, Admin's `site-management`, `site-logo-copy` and `site-upload-proxy` tests, Platform's `site-ownership` test, shared manifest tests and Sites `core` tests. The Windows Chromium bridge currently times out before the provision control, so these component/backend checks are not a passing real-browser journey.

## Browser acceptance when an approved fixture is available

1. Open separate editor, reviewer, standard publisher, sensitive publisher, domain requester and Platform operator sessions. Confirm bounded read content and absence of unrelated controls. A reviewer can record approval without editing; a publisher can check and publish without editing or preview authority. A standard publisher cannot publish sensitive content.
2. Save a versioned private draft. Review exact field digests and immutable image checksums. Choose the real source and dated or until-revoked duration. Missing source, missing duration, changed classification, contradictory dates and cancelled confirmation must not produce approval. Until-revoked owner attestation must not claim document inspection.
3. Replace finite approval, then publish again. Confirm a new publication and new evidence IDs without changing the old publication or approval. Confirm actual expiry/revocation and latest applicable withdrawal deny pages and bytes instead of reviving older evidence.
4. Request a hostname and keep its persistent TXT installed. Adoption of an existing legacy hostname requires exact-host confirmation, valid old proof and fresh readiness. Reject expired/stale/locked/suspended/retired states. Adoption preserves token, generation and active routing. Explicit rotation changes token/generation and interrupts traffic until fresh checks and activation. Viewing either page must not call provider POST or activate anything.
5. Inspect favicon, Apple icon and manifest on two admitted hosts. Old configuration uses its published school logo. An approved published `site_favicon` overrides only that school. Private draft or Admin logo changes must not affect public output. Stale DNS/TLS/project/marker observations or asset revocation must deny public bytes.
6. Copy the selected school's Admin logo only after explicit confirmation. Verify PNG/JPEG and bounded WebP conversion through the existing upload proxy, school-ID mismatch denial, cancellation/error state and reload persistence of the private asset. No Admin storage URL/ID may become a public source. Save/select/review/publish remain separate steps.
7. Exercise mobile widths, keyboard focus, source/lifetime selection, upload error states, version conflicts and cancellation. Retain exact observations and label unexercised paths as blocked, not passed.
