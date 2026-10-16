# Implement upkeep rules and tenant icon controls

## Objective
Implement docs/features/ManagedSiteUpkeepAndBranding.md: explicit until-revoked approval, persistent authoritative TXT checks, capability-specific UI, published logo/default icon with override and explicit private Admin-logo copy.

## Scope
Sites backend/shared schema/contracts/tests, relevant Admin/Platform Sites UI, Sites icon metadata/manifest and focused tests/docs. Preserve existing uncommitted access setup and launch artifacts. No credentials, remote operations, deployments, commits, branch changes or unrelated fixes. Child is the sole implementation writer; parent does not write source concurrently.

## Definition of done
Legacy finite approvals/domains remain finite without explicit supported transitions. Missing expiry without its explicit marker remains invalid. Actual expiry/revocation, reviewer independence, immutable content, exact asset provenance, host isolation and finite freshness remain enforced. Relevant tests/types/lint/schema and colour audit run. Report blockers instead of weakening tests. Independent review and owner-authorized release are later tasks, not part of this implementation task.

## Expected artifacts
A merge-ready scoped diff, focused regression tests, updated operating/feature docs, exact adoption API/approval argument shapes and command results with limitations. No live mutations.

## Implementation handoff

See [the B01 implementation report](../B01_implementation_report.md) for exact changed files, API argument shapes, compatibility notes and actual check results. Source implementation is ready for independent review; this task is not marked reviewed, released or complete.

- [x] Add explicit approval duration/source and consistent evidence gates without rewriting old approvals or publications.
- [x] Add persistent TXT policy, audited exact-host legacy adoption and consistent proof validity.
- [x] Separate effective capability flags and Admin/Platform controls without changing the Admin navigation icon.
- [x] Add published-logo icon default, optional favicon override and explicit authenticated Admin-logo byte copy.
- [x] Add focused regression coverage, compute schema fingerprints with the existing utility, and update policy/operations docs.
- [x] Run affected package types, scoped lint, schema coverage, component/public/shared tests and informational colour audit.
- [ ] Resolve or explicitly accept the known Windows Chromium bridge blocker. It timed out before provisioning, so no real-browser feature acceptance is claimed.
- [ ] Confirm backend suite timing stability. An earlier focused run passed all 51 tests; a repeat had one 30-second timeout, then the affected contract file passed all 12 tests in isolation.
- [ ] Parent independent source review and separately authorized release/live acceptance. No real reviewer approvals, publication or domain adoption occurred in B01.
