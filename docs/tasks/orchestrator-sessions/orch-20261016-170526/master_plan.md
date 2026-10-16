# Sites upkeep and self-service

## Context

The owner has authorized completing the website work now, including necessary live-side changes. Finish the issues discussed in this thread: remove unnecessary monthly approval/domain renewal work, restore capability-specific reviewer/publisher controls, and use a school website icon with a school-logo default and optional override. Do not interpret this as permission for unrelated product work, fabricated approvals, billing changes or unbounded deployments.

Only Production `outgoing-warbler-782` and existing `melo-sites`/Admin hosting may be released after focused checks and review. Preview `expert-giraffe-253`, Development, other schools' records, email DNS, payments and application activation remain outside scope. Preserve all existing uncommitted work.

## Plan

1. Inspect the current contracts and record the safest compatible changes.
2. Update the feature contract, then implement backend lifespan rules, role controls and tenant icon handling sequentially.
3. Run focused regression checks and one independent review before any release.
4. Deploy only the reviewed Production targets and re-record owner-approved evidence with the real independent reviewer.
5. Verify public output and account controls, close operational windows and retain evidence.

The single initial task is deliberate: scope and contracts must be understood before meaningful design and implementation packets are added. This is an existing-product repair, not a new full-project scaffold.

## Genesis

Inspect current evidence, publication, asset, domain observation/maintenance, branding and UI contracts. Distinguish genuine consent expiry from an artificial application deadline. Choose the smallest backward-compatible design that preserves revocation, independent reviewers, immutable published content, host isolation and actual DNS/TLS/provider checks. Existing approvals must not silently become indefinite; any replacement approval must use the real independent reviewer and truthful owner-attestation provenance. No far-future timestamps.

## Design

Use existing Admin components and styles. Make controls match actual capabilities, show expiry/revocation clearly, and explain automatic domain rechecks versus destructive proof rotation. Website branding is published configuration, not a live mirror of private Admin state. Default icon selection must not leak private storage or cross-school branding.

## Build and release

Implement sequentially with focused tests. Validate backend/shared/Admin/Sites types, affected lint, schema coverage and theme audit where relevant. Review the scoped delta once, address confirmed blockers, then release only exact reviewed source and target. Use private credential grants for real reviewer/operator/publisher actions, keep operational flags off outside approved windows, sign out and revoke temporary tool grants. Stop on provider quota or uncertain deployment outcomes rather than retrying.

Verify the real public website, favicon, redirects, approved asset bytes and private route denial. Exercise reviewer and publisher entry points with separate identities where access permits; do not mislabel isolated synthetic tests as Production user-path evidence. Retain exact deployment IDs and results. Report any unfinished work honestly.

## Completion

The owner no longer needs monthly content approval or manual domain token rotation merely to keep unchanged approved content online. Actual expiries, withdrawals, security failures and temporary account permissions still work. Correct roles can operate their own UI controls. The website has a tenant-correct icon without silent Admin-to-public synchronization. Tests and focused review pass, and live changes are verified before completion is claimed.
