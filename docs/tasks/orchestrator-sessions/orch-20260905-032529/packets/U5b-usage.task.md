# U5b — Usage views and paid-operation preflight

## Objective / scope
Wire plan-owned allowance/usage UX and reservation lifecycle to real expensive actions, preserving privacy and idempotency. Separate from asset library and payment activation.

## Context / dependencies
U5a/U3c. Read H8 and metering.ts. getUsageStatus/listUsageEvents currently require finance.reports.view; allocateQuota/reserveUsageQuota/commitUsageQuota/releaseUsageQuota are internal and have no runtime callers outside metering. Actual first consumer seams: Teacher lesson-plans calls documentGeneration.generateTeacherLessonPlanDraft; library calls lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl/finalizeKnowledgeMaterialUpload/requestKnowledgeMaterialProviderOcr; OCR worker is lessonKnowledgeOcrActions.processKnowledgeMaterialOcrJobInternal. Knowledge upload currently has a distinct 12MB constant, not a proven plan-derived cap.

## Ownership
metering.ts, proposed billing usage + Platform commercial usage, the named first-operation UI/backend seams and tests. Enumerate additional touched provider calls before adoption; do not claim all AI metered based on one action. Serialize schema and respect U3c form adapters.

## Instructions
1. Add scope-safe teacher preflight summary distinct from finance/global provider economics. Plan configuration owns caps/pages/thresholds/cycles/group pools/branch allocations/top-ups/exceptions and task model profiles; raw dimensions remain technically measurable without prompt/document content.
2. Reserve estimate before accepted expensive work, settle actual usage and release remainder. Provider/Melo failure does not consume customer allowance; retain actual internal provider cost. Stable operation IDs prevent duplicate charging and support unknown-timeout reconciliation.
3. Display compact normal usage and heavy-operation confirmation with file size/page ranges/estimated impact/remaining balance. Explain 75/90/base/grace thresholds and exact shortfall/remedies; no hard cutoff mid-accepted generation. Cancel before work incurs no charge.
4. Plan-limit validation is authoritative server-side; selected page/batch proposals must be confirmed and retries operate only on failed batches. Include active/trash/temp storage separately through U5c/U5d seam. Keep paid provider execution gated; local test doubles only.

## Definition of done / verification
Focused metering/action tests cover concurrent reservation, repeated retry/settle, fail/release, cycle/top-up/exception, unauthorized totals and upload/range validation. UI loading/no entitlement/estimate failed/quota blocked/confirm/cancel states. Tests/typechecks recorded; per-operation coverage manifest explicitly marks ungated/unmetered work incomplete.

## Execution status

**PARTIAL/GATED, E0 — keep open for provider/action adoption and U7 evidence.** Safe local productization now includes immutable entitlement versions, contract-bound cycles, separate grace/top-up/exception/group-pool sources, proprietor branch allocation, configured thresholds/task profiles, and an idempotent authoritative quote/confirm/cancel workflow. Confirmation atomically holds then releases allowance through a deliberately unavailable dispatch and charges zero. Real provider dispatch, upload/range and failed-batch adoption, timeout reconciliation, generated API/schema rollout, and browser evidence remain incomplete. See `../results/U5b.md`.

## Artifacts
`results/U5b.md` operation/cost-call manifest, entitlement/reservation contracts, commands/self-review and provider telemetry gates. Update matrix. No provider/production/migration/deploy/credential or unapproved CLI/PR operations.
