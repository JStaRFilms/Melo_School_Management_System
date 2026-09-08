# U5d — Asset Archive, Trash, holds and PDF disclosure

## Execution status
Local implementation slice delivered after U5c; **PARTIAL / E0**, not full acceptance. Actual Archive/Trash/inspect/restore/holds/exact-confirmed purge and gated PDF disclosure verified with local synthetic tests. See `../results/U5d.md` for remaining cleanup fairness/failure ledger, backend failure injection, commercial policy linkage and required U7 screenshots. No live destructive operation or commit.

## Objective / scope
Add first-class asset Archive/Trash navigation, safe recovery/permanent-delete controls and honest gated PDF optimization states. Preserve existing academic Archive.

## Context / dependencies
U5c. Read H9/D03 and assets.ts lifecycle. Existing functions: trashAsset/listTrashedAssets/restoreAsset/applyRetentionHold/removeRetentionHold/permanentPurgeAsset; cleanupExpiredAssetStorage internal. PDF verification/commit/rollback functions are internal. Academic `/academic/archived-records` uses archiveRecords.listArchivedRecords and entity restore mutations; it is not asset Trash. Asset archive lifecycle is not established merely by this route.

## Ownership
assets.ts lifecycle sections after U5c; proposed `/admin/assets/archive`, `/admin/assets/trash`, library inspection panel, academic Archive cross-link only; tests. Schema/capability changes serialized.

## Instructions
1. Implement distinct archive vs trash semantics and navigation with filters/inspection and return-to-library links. Normal deletion moves to Trash; default 30-day recovery is policy-configurable, not promised regardless of retention.
2. Show item owner/scope, safe metadata, expiry/countdown and active/trash/temp accounting. Trash bytes remain charged until purge succeeds; expired cleanup failure remains visible/retryable. Restore preserves original ownership/sharing rather than broadening access.
3. Separate restore/hold/permanent-delete authority; holding trash capability must not silently imply proprietor hold removal. Require exact target confirmation for permanent purge (existing API expects PURGE plus file name), tenant/capability/hold checks and immutable audit. Do not execute purge/cleanup for inventory or on real data.
4. PDF inspector shows eligible/skip/unavailable evidence. Signed/encrypted/form-sensitive/malformed/unsupported files remain unchanged. Internal candidate verification/commit/rollback never becomes a fake client success; preserve original and approved cleanup policy. No image-compression/savings claim or native binaries without D03 runtime/fidelity approval.

## Definition of done / verification
Tests cover navigation/inspect, archive distinct from trash, restore scope, hold denial, confirmation, idempotent purge/cleanup failure accounting and PDF stale/unsafe/failed candidate preserving original. Local tests/typechecks recorded. U7 synthetic Trash/hold/error/restore screenshots required; destructive live acceptance stays gated.

## Artifacts
`results/U5d.md` lifecycle/permission/retention/PDF gate matrix, tests/self-review and screenshots requests. Update matrix. No production, provider, migration, deployment, credentials, live purge or unapproved CLI/PR operations.
