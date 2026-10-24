# Reuse validated Sites assets within one query

## Objective
Reduce repeated database reads in the largest measured production-class functions, Sites publicAtTime and assetAtTime.

## Evidence and scope
October read-only function telemetry reports 172419366 internal read bytes for publicAtTime and 75395029 for assetAtTime across prod-class deployments. This is not per-function response egress and not outgoing-warbler-only attribution. state() validates the entire publication, including approvedAsset reads. The same query then invokes approvedAsset again while producing each public DTO or authorizing the requested asset.

## Implementation
Keep the assets already validated by validatePublication in its return value, retain them locally in state(), and reuse them only within that same database transaction. Use plain typed values without a module/global cache. If duplicate references are deduplicated during validation, enforce the expected kind for every reference. Keep all existing publication digest, metadata/checksum, independent reviewer, latest evidence, consent, current domain and 15-minute freshness gates. Preserve pre/post-storage authorization as separate fresh assetAtTime invocations. No stale permissions, external API or schema changes.

## Definition of done
Public responses remain unchanged and never expose storage IDs/evidence. Focused synthetic tests demonstrate fewer read calls/documents and verify fresh revocation, expired evidence, cross-school and wrong-kind failures remain closed. Run existing Sites activation and security suites. No frontend behavior redesign or remote writes.

## Expected artifacts
Narrow shared.ts/public.ts diff, focused regression tests and reproducible synthetic before/after read evidence with billing limitations.
