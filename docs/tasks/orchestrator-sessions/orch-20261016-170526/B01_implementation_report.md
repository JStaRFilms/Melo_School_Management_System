# B01 implementation report

## Status

Implementation is ready for the parent's independent source review. B01 remains in progress because real-browser acceptance is blocked and review/release are separate tasks. No credentials, live service calls, remote mutations, deployments, resets, Preview operations, commits or branch changes were performed. Tests used synthetic records, mocked providers and local TLS fixtures only.

The existing access setup source, generated API declarations, capability-grant schema/registry changes and all `deliverables/obhis-hosted-launch` operational files were preserved. This task adds only the approval/domain schema fields and the two corresponding registry fingerprints. The existing utility `schemaReferenceInventory` computed those fingerprints in a temporary local Vitest script, which was removed afterward. No remote codegen was used. Adoption is an export of the already-declared `domains` module, so it needs no new generated module declaration.

## Changes

- Explicit until-revoked Sites approval with truthful source kind and confirmation. Missing, contradictory, nonfinite, past or over-limit expiry arguments deny. Legacy finite callers remain compatible. Current field evidence selects newest first, then checks validity and publisher independence. Rights and child consent retain exact evidence pointers; classification uses the latest assertion. New indefinite rights clear only the asset's previous deadline. Old evidence and publication content/IDs are not rewritten.
- Persistent authoritative TXT policy on new requests and explicit rotation. Authenticated exact-host operator adoption requires valid legacy proof and fresh `ready()` observations, preserves TXT/generation/routing and writes an audit event. Snapshot, commit, readiness, reservation and instructions share the proof-validity rule. Five-minute read-only maintenance, fifteen-minute freshness, project/TLS/marker checks, provider locks and disruptive generation-bound rotation remain enforced.
- Independent edit, review, standard/sensitive publish, preview, revert and domain-request flags. Review and publish work without edit permission. Authorized bounded private read projections remain. Source/lifetime controls use truthful owner-attestation wording. Platform adoption is separate from existing confirmed provider operations. No Admin navigation icon changed.
- Optional renderer-v1 `site_favicon` of kind `favicon`, with published `school_logo` default. Metadata and manifest use only admitted first-party assets. The overriding shared `apps/sites/app/icon.png` was removed. Old configs/digests remain compatible. Admin uses manifest-driven asset pickers and an explicit selected-school logo byte-copy path through the existing upload proxy. PNG/JPEG pass through, WebP is bounded before browser decoding and converted to PNG. Copying does not save a draft, create approval or publish.

## Supported calls

Explicit indefinite field approval:

```ts
api.functions.sites.evidence.approveCandidate({
  schoolId,
  candidate: { kind: "field", fieldId, expectedDigest },
  evidenceReference: "Truthful reference to the actual authorization",
  validity: "until_revoked",
  sourceKind: "owner_attestation", // or "document_review"
  confirmed: true,
  // No expiresAt.
});
```

The same lifetime arguments apply to existing `asset_rights`, `asset_child_applicability` and `asset_child_consent` candidates. Asset candidates require `assetId` and `expectedChecksum`; classification also requires `classification: "no_children" | "contains_children"`. Dated approval supplies a finite future `expiresAt` within 366 days, with no `validity` marker. Legacy finite callers may omit `sourceKind`.

Existing domain adoption:

```ts
api.functions.sites.domains.adoptPersistentOwnership({
  domainId,
  confirmation: "CONFIRM PERSISTENT <exact stored hostname>",
});
```

Use an authenticated active platform operator after a separate passing read-only readiness check. Adoption cannot recover an expired legacy proof, bypass a lock or activate a hostname. Rotation is the separate disruptive recovery/security operation.

## Checks actually run

| Check | Result |
| --- | --- |
| `pnpm --filter @school/convex exec vitest run functions/sites --exclude '**/browser-bridge.test.ts' --testTimeout=30000 schemaCoverage.test.ts` | Earlier run passed 13 files, 51 tests. Final repeat passed 50 tests and timed out on the new asset lifetime test at 30 seconds. No assertion failure was reported. |
| `pnpm --filter @school/convex exec vitest run functions/sites/sites.test.ts --testTimeout=30000 --reporter=verbose` after that timeout | All 12 tests passed. The previously timed-out asset test took 2.084 seconds; the existing image-heavy Olive test took 5.810 seconds. No assertions or timeout configuration in source were weakened. |
| Admin `site-management`, `site-logo-copy`, `site-upload-proxy` | 3 files, 16 tests passed. |
| Platform `site-ownership` | 1 file, 2 tests passed, including confirmation/cancellation, no automatic provider calls and stale adoption denial. |
| Sites `vitest run core` | 6 files, 21 tests passed, including logo default, favicon override, manifest, old config and host/private-source denial. Existing React `fetchPriority` warning remains. |
| Shared `site-manifests.test.ts` | 1 file, 5 tests passed. |
| `typecheck` for `@school/convex`, `@school/shared`, `@school/admin`, `@school/sites`, `@school/platform` | All passed on the final applicable runs. Initial new test-hook return-type errors were corrected and rerun. |
| Root ESLint on all changed TS/TSX implementation and test paths, including schema | Passed with no output. |
| `git diff --check` | Passed. |
| `node scripts/audit-theme-colors.mjs` | Passed, informational. `red-700` is semantic error status; slate/white classes are product neutrals. Fixture `#176c49`/`#39bcd3` are tenant primary/accent inputs; `#142c38`/`#ffffff` are neutral test assertions; `#00000000` is an intentionally invalid-token test. The unrelated profile-corrections `rose-700` finding came from the audit's comparison base and was not changed. No global colour replacements. |
| `vitest run functions/sites/browser-bridge.test.ts` | Failed at the existing Windows provisioning entry point: WebSocket port-in-use warning and 30-second timeout waiting for `Provision synthetic renderer`. It never reached affected acceptance paths. No unrelated bridge/root-path repair was attempted. |
| Root `pnpm typecheck` | Not rerun. The known unrelated Teacher build issue is outside this task; this report does not claim root success. |

The first attempted backend command used `pnpm ... test -- ...`, which forwarded `--` incorrectly and ran the full backend suite before the new schema fingerprints were updated. It reported 905 passed and 17 failed tests across 115 files, including schema-dependent failures and timeouts. That broad run is not a passing release gate and was not repeated. Subsequent checks used direct `exec vitest run` filters. Only the focused results above are claimed.

Raw local output remains in ignored root `.sites-*.log` files, including `.sites-backend-focused.log`, `.sites-backend-contract-recheck.log`, `.sites-browser-bridge.log`, `.sites-admin-tests.log`, `.sites-platform-tests.log`, `.sites-public-tests.log`, `.sites-shared-tests.log`, typecheck logs and `.sites-theme-audit.log`.

## Exact files changed by B01

Backend/shared:

- `packages/convex/schema.ts`
- `packages/convex/schemaCoverageRegistry.json`
- `packages/convex/functions/sites/shared.ts`
- `packages/convex/functions/sites/evidence.ts`
- `packages/convex/functions/sites/domainRules.ts`
- `packages/convex/functions/sites/domains.ts`
- `packages/convex/functions/sites/management.ts`
- `packages/convex/functions/sites/reads.ts`
- `packages/convex/functions/sites/sites.test.ts`
- `packages/convex/functions/sites/domains.test.ts`
- `packages/convex/functions/sites/domainRules.test.ts`
- `packages/convex/functions/sites/browser-bridge.test.ts`
- `packages/shared/src/site-manifests.ts`
- `packages/shared/src/site-manifests.test.ts`

Admin/Platform/Sites:

- `apps/admin/app/admin/settings/site/page.tsx`
- `apps/admin/lib/site-logo-copy.ts`, new
- `apps/admin/__tests__/site-management.test.tsx`
- `apps/admin/__tests__/site-logo-copy.test.ts`, new
- `apps/platform/app/schools/[schoolId]/site/page.tsx`
- `apps/platform/__tests__/site-ownership.test.tsx`, new
- `apps/sites/app/icon.png`, deleted
- `apps/sites/app/manifest.ts`
- `apps/sites/core/public.ts`
- `apps/sites/core/seo.ts`
- `apps/sites/core/olive-public.test.tsx`

Documentation:

- `docs/features/AdmissionsAndSiteFoundationContract.md`, preserving its earlier access-setup amendment
- `docs/features/ManagedSiteUpkeepAndBranding.md`, pre-existing authored contract with implementation/API notes added
- `docs/tasks/sites-production-core-operations.md`
- `.agents/skills/verify-melo/features/README.md`
- `.agents/skills/verify-melo/features/managed-sites-upkeep.md`, new
- `docs/tasks/orchestrator-sessions/orch-20261016-170526/in-progress/B01_implement_upkeep_rules_and_tenant_icon_controls.task.md`
- This report

`packages/convex/_generated/api.d.ts`, the access setup files/docs and launch deliverables already differed at task start and were not edited by B01.

## Deployment compatibility and unfinished verification

Deploy the additive schema/backend before the new Admin/Platform controls. Deploy Sites with its matching optional descriptor and metadata, including deletion of the static app icon. Old drafts/publications retain their content digests, unmarked domains retain finite deadlines, and old finite approval callers remain valid. Old backend builds will deny indefinite approvals/proofs, so do not roll backend lifespan support back while relying on adopted records.

No real approvals, evidence replacements, publications or domain adoptions were recorded. The parent must independently review once, perform the separately authorized exact-target release, use the real independent reviewer/publisher, and adopt only authorized hostnames through the supported API. Do not patch evidence IDs or published records directly.

Blocking verification limits are the Windows real-browser bridge and intermittent backend test timing. Actual private-logo download/CORS and browser WebP conversion against the selected school's real logo were not exercised because live service access was prohibited. Local mock/component checks do not attest those live user paths, mobile/keyboard acceptance, deployed maintenance, TLS/provider configuration or the public favicon after deployment. No security or pipeline bypass was added to work around that limit.
