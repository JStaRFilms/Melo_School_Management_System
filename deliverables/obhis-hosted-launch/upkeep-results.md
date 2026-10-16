# Olive website upkeep results

Verified on 2026-10-16. The website remains live at https://www.oliveblessed.com, with the apex redirect intact.

## Completed on Production

- Replaced the artificial dated website approvals with 64 explicit until-revoked records through the real independent reviewer. Their source is `owner_attestation`, not a claim that signed consent documents were inspected. The old dated records remain unchanged.
- The real lead published unchanged content as revision `z17c5aq3cq9bhqjh4fnz4gm1fh8gcj8z`. Its digest matches the previous publication, and its 40 field-approval IDs reference the replacements. All nine original images retain their exact checksums. No old publication was edited.
- Adopted persistent authoritative TXT policy for only `www.oliveblessed.com` and `oliveblessed.com`, using the supported exact-host operator mutation after fresh readiness checks. Their existing TXT values, hashes, host assignments and active routing are unchanged. There is no November 15 renewal deadline on these active proofs.
- Verified newer automatic ownership/routing/TLS observations after a full fifteen-minute observation window, without manual readiness calls between adoption and verification. The existing freshness, certificate, project assignment and deployment-marker gates remain enforced. Persistent ownership does not bypass failed checks, revocation or suspension.
- Deployed separate editor, reviewer, publisher, preview, revert and domain controls. Real reviewer, publisher, editor and platform browser paths passed. Reviewer and publisher actions no longer depend on editing access.
- The public favicon, Apple icon and manifest icon now use the published school logo. Authorized editors can select an optional website-specific favicon. A separate explicit Admin-logo copy enters private website storage and still needs selection, review and publication; Admin branding saves do not silently change the website.

Actual consent end dates still matter. Dated approvals remain supported and enforce their expiry. Missing dates without an explicit until-revoked policy remain invalid. Old records were not globally reinterpreted.

## Releases

Only Production backend `outgoing-warbler-782` was deployed. Additive schema validation passed and no indexes were deleted.

Reviewed local source snapshot: `c8def46bf536203c411984b52a90ab4f09161d0b6b5cef73557eb721c0a8d956`, based on `d2ba632a09776e43684a99b4739885974790e094` plus the reviewed local changes. The source upload contained 1,283 build files and excluded private environment files, launch artifacts, evidence and worktrees. No Git commit, push or branch switch was performed.

| Hosting project | Final Production deployment | Result |
| --- | --- | --- |
| `melo-sites` | `dpl_74xn9cnbjVdL5YDXnKhgE7vjMfK6` | READY |
| `melo-admin` | `dpl_BE6HLHKPqb5qu2FurqzXqssv4i2j` | READY |
| `melo-platform` | `dpl_8h7vBgChkGfCM9bZtWCrfvyepcpQ` | READY |

The first Admin source release, `dpl_BCRGRQPGVLWvsE9jJsPXXbqT8P5z`, was READY but a real logo-copy check exposed an absent server upload setting. The proxy requires `CONVEX_SITE_URL`; the existing public auth endpoint variable did not substitute for it. Added only the exact Production HTTP origin to the existing Admin project's encrypted Production environment and redeployed the same reviewed source. The subsequent real upload passed. This was a confirmed configuration repair, not a quota retry or a code change after review. A transient read-only Platform preflight failure occurred before any deployment attempt; its first actual deployment was then accepted. No quota failures, billing changes or duplicate uncertain deployment writes occurred.

Preview, Development, other school data, email DNS and unrelated projects were not modified. No DNS update was needed for persistent adoption.

## Verification retained

- Independent source review found no blocking issue. T3 review task suffix: `sites-upkeep-focused-review-20261016-r1`.
- Parent serial backend/schema run passed all 51 tests across 13 files.
- Implementation checks passed Admin 16 tests, Platform 2, Sites 21 and shared 5; affected package typechecks, scoped lint, schema coverage and informational theme audit passed.
- Real Chrome sign-in and separate-role paths passed on desktop and 390px mobile. Reviewer source/lifetime form, publisher gate check, editor-only controls and Platform persistent-domain status were exercised. Screenshots, mobile keyboard/no-overflow assertions and zero page-error counts are in `upkeep-browser-evidence/`.
- Actual Admin-logo download and authenticated private upload passed. The copied asset `yn7bz9zwzdckt29w9c1ndhtvqd8gcmw2` remains private and unapproved. Its temporary unsaved selection was discarded by reload; the original saved logo and website draft were preserved. This deliberate verification artifact is retained rather than deleted through an unsupported operation. Its public asset URL returns 404.
- Canonical homepage returns 200; apex returns 308 to HTTPS www; both exact deployment markers return 200 without redirect. All nine original asset bytes match their approved SHA-256 checksums. Private review page/asset routes return 404.
- Fresh public browser metadata and manifest point to the published logo, gallery selection works, and mobile has no document overflow, visible broken images or page errors.
- `upkeep-state-verification.json` records actual replacement policy/source, preserved old approvals/publication, unchanged content/images/TXT, finite publisher access and closed operational flags. `upkeep-public-verification.json` records the public checks. `upkeep-operations-ledger.json` and `upkeep-release-ledger.json` retain exact operation and deployment IDs without credentials.

## Limits and cleanup

The old Windows synthetic browser bridge still fails before its provisioning step; it was not represented as passing or repaired out of scope. The unrelated Teacher root build was not repaired or represented as passing. Real Production feature paths were verified separately under the owner's explicit authorization. The favicon override has focused contract/component coverage; the owner has not supplied a distinct replacement icon to publish. WebP conversion has local tests; the real Admin-logo copy verifies the school's actual image format, not every format.

Temporary school account permissions still expire on their approved schedule. The lead was restored to the publisher package without extending its original expiry, 2026-10-23 at 10:12 UTC. That expiry does not expire the already-published website or its approval records. Reviewer/publisher independence remains intact. Setup and provider-write flags are off. Temporary authenticated sessions signed out after each use; current upkeep tool grants are revoked at handoff. The tool-owned temporary source staging directory is removed after release.

Application links, donations and campus information remain the previously approved content, including their unavailable/coming-soon states. The richer review-preview work in issue 131 is not claimed complete and the issue remains open.

Source changes remain uncommitted in the root checkout. They need the normal reviewed commit/merge path before a future Git-driven release; do not redeploy an older backend that cannot read the new lifetime policies.
