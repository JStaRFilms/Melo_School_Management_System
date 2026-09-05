# S0 storage safety stabilization

**Status:** local security remediation implemented and verified; upload features remain **unavailable / externally gated**, not complete. No live storage, backend, provider, deployment, migration, index operation, credential, commit, or production operation was performed.

## Decision

The available Convex transport issues a generic upload URL. Repository code cannot use that URL to prove the uploaded object's school, authenticated caller, or purpose; a client-supplied storage ID and MIME marker are not authoritative provenance. The transport also cannot enforce the purchased byte cap before transfer or guarantee deletion/accounting release for a client that uploads and abandons finalization.

The secure stabilization therefore fails closed rather than inventing a transport protocol:

- asset-library intent issuance and finalization are server-disabled after tenant capability checks;
- school-logo and student-photo URL issuance and new-storage binding are server-disabled after their existing domain authorization checks;
- staff knowledge and Portal supplemental upload issuance/finalization are server-disabled before creating shells, bindings, rate-limit events, processing jobs, or storage claims;
- PDF candidate intake/evidence is also disabled because its candidate storage provenance is not authoritative;
- capability revocation and cross-tenant denial remain terminal before the unavailable-transport response.

No generic URL is issued. Purchased quota present or absent does not change this: no pending intent, reservation, consumption, usage event, material shell, or asset row is created.

## Existing data and global claim boundary

Authorized compatibility reads for existing school logos, student photos, knowledge originals, Portal/report-card projections, and historical report snapshots remain available. This does **not** retroactively label old uploads as provenance-verified.

`assetStorageBoundary.ts` now defines the global owning-purpose check across admissions documents, site assets, school logos, student photos, knowledge materials, asset intents/assets/rollback copies, PDF candidates, and pending demo cleanup. Additive storage indexes support bounded checks. A storage ID already owned by any purpose cannot be newly claimed. Destructive logo, asset, rollback, candidate, derived-knowledge, and demo-cleanup paths require the expected exclusive owner before deleting bytes (a finalized asset intent linked to its exact asset is treated as provenance, not a second owner). Compatibility reads reject conflicting multi-purpose ownership and asset/quarantine bindings; the existing explicitly modelled accepted-application-photo reference is the only allowed two-record reference pair. Zero-claim immutable historical snapshot reads remain compatibility reads, not new ownership evidence.

The trusted server-produced selected-page replacement path now checks the same global unclaimed boundary and deletes its just-created derived object if atomic claim replacement fails. Demo seed intake rejects duplicate or previously claimed server-created objects before creating its school. These internal paths do not make generic caller uploads safe.

This claim model is present for safe future transport work, but no upload feature is enabled by it. A future implementation still needs trusted transport callback/provenance, versioned purchased entitlement, pre-transfer bounded reservation, outstanding-intent caps, provider size enforcement, and durable abandoned/expiry cleanup before the server gate may be removed.

## Truthful UI

- Admin Assets reports upload unavailable and retains authorized inventory/inspection/history.
- Admin Branding disables choosing a new crest while retaining the existing crest and removal action.
- Student create/edit/onboarding photo controls show an unavailable note; existing photos remain visible and removable.
- Teacher Planning shows the transport gate instead of upload controls and disables the mobile upload action.
- Portal supplemental upload inputs are disabled with explicit transport/quota/cleanup copy; approved existing resources remain readable.

Disabled controls are not completed workflows.

## Regression coverage

Focused tests cover:

- authorized historical logo/student-photo reads;
- conflicting legacy cross-purpose ownership denial;
- global already-owned storage rejection;
- no URL/intent/material-shell creation with allocated quota;
- asset, logo, student, staff-knowledge, and Portal finalization denial for one generic storage ID;
- unchanged historical bindings and no generic-ID claim after denied finalization;
- cross-tenant denial before transport state;
- revoked `assets.upload` denial before transport state;
- asset workspace `uploadAvailable: false` and truthful Admin UI;
- teacher upload-capability behavior while transport remains unavailable;
- existing asset lifecycle, authorization, AV/download closure, migration, cleanup, PDF utility, and historical rollback coverage using directly seeded historical fixtures rather than disabled public intake.

## Checks run

- `pnpm --filter @school/convex typecheck` — pass.
- `pnpm --filter @school/admin typecheck` — pass.
- `pnpm --filter @school/teacher typecheck` — pass.
- `pnpm --filter @school/portal typecheck` — pass.
- Convex focused regression run: `storageSafety.integration.test.ts`, `assetWorkspace.integration.test.ts`, `securityAuthority.integration.test.ts`, `commercialAndAssets.integration.test.ts`, `teacherPlanningAuthorization.integration.test.ts`, and `seedRunnerGate.test.ts` — 6 files / 43 tests pass. Existing known 30-day timer overflow warnings remain in the commercial/assets suite.
- Admin: `assets-workspace.test.tsx` — 1 file / 5 tests pass.
- Teacher: `LibrarySidebar.test.tsx` — 1 file / 2 tests pass.
- `node scripts/audit-theme-colors.mjs` — completed informationally; touched direct colours classify as existing semantic status/product-neutral usage and no global replacement was made.
- `git diff --check` — pass; Git emitted existing LF-to-CRLF working-copy warnings only.

## Self-review

- Re-searched `packages/convex/functions`: no `generateUploadUrl` call remains.
- Confirmed every affected caller-facing finalizer reaches the centralized unavailable gate only after its tenant/domain authorization checks and before storage binding, accounting, audit, shell, or processing writes.
- Confirmed destructive owned-storage paths use expected-owner checks so compatibility corruption fails without deleting shared bytes.
- Confirmed historical URL signing is read-only compatibility behavior and cannot create provenance or a new claim.
- Reviewed the final diff for scope; no unrelated product feature, dependency, provider integration, deployment, or migration was added.

## Remaining gate

Upload remains externally/runtime/provider gated **and** lacks an approved internal transport adapter. The additive ownership indexes and code are local only; no deployment, index operation, data migration, or historical provenance backfill was attempted. Required future work is not a migration of user-provided IDs or MIME markers. It must deliver authoritative school/caller/purpose evidence, versioned purchased entitlement, reservation before bytes transfer, provider-bound size limits, single-use claim settlement, and durable cleanup/reconciliation for abandoned, rejected, revoked, expired, oversized, and failed uploads. Until then, issuance and finalization must stay disabled.
