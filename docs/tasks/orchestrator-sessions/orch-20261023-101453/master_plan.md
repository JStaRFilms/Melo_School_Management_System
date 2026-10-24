# Convex egress and I/O optimization

## Context
The owner reported historical October usage of 820.02 MB egress and 550.67 MB database I/O. User Function Reads account for 500.85 MB, exceeding file serving, backups and fetch egress. The maintenanceCheck fetch table is not the client response category. Read-only aggregate usage has now been refreshed. Deployment metadata is verified, but the dashboard function table groups copied-data Preview and Production under the same prod type and ignores deployment-name filters. Individual Production client-response attribution remains unmeasured.

## Objective and scope
Reduce response bytes and database reads through local changes backed by actual UI consumers and synthetic evidence. Preserve tenant isolation, authorization, complete results, grading locks, balances and autosave reliability. Work from the clean master checkout on perf/convex-egress-evidence. No deployment, reset, migration, seed, deletion, remote configuration change or job disabling is authorized.

## Actionable plan
1. Inspect root guidance, generated Convex rules, QA setup and deployment selectors. Verify identity before remote access and keep secrets and records out of output.
2. Trace archiveRecords and adminSelectors to consumers and existing indexes. Delegate one bounded read-only DeepSeek analysis of subscriptions, file delivery and scheduled work while the parent investigates queries. The initial single Genesis packet covers this investigation; Build packets will follow concrete findings rather than speculate.
3. Select the smallest safe implementation with measurable read or response reduction. Use existing contracts or update all consumers together. Never truncate complete lists with take limits.
4. Implement in one shared-checkout write stream, add focused synthetic regression tests and record before/after documents, queries and JSON bytes where feasible.
5. Run focused tests first, then relevant types and builds. Conduct one focused review and a simplification pass. Report unverified UI/production behavior honestly.

## Risks and mitigations
Local selectors may target production or the wrong development backend. Do not run Convex dev/deploy/codegen or integration setup. Broad archive history counts are correctness-sensitive, so preserve lock redaction and semantics. Projections reduce response size, not stored-document reads. Duplicate identical subscriptions can share Convex caching; do not count hooks as executions.

## Selected implementation and evidence
Archive history reads are now conditional, class dropdowns use the compact additive listClassOptions API, and Sites reuses validated asset documents only inside one database transaction. Existing full APIs and authorization/freshness gates remain intact. OpenCode DeepSeek performed bounded read-only research; GLM implemented the archive slice. The parent completed the remaining bounded edits and one focused review after the child writer stopped. Detailed checks, synthetic measurements, attribution limits and later release steps are in docs/tasks/ConvexOptimizationEvidence-20261023.md.

## Deliverables and completion
A reviewed implementation, focused regression coverage, reproducible synthetic evidence, deployment/configuration map, confirmed causes versus hypotheses, ranked remaining work and an exact proposed rollout/rollback procedure requiring later approval. No UI redesign or new persistent data flow is intended, so Design is not needed.

## Later authorization and release handoff
The initial no-deploy scope above applied to local investigation and implementation. The owner later authorized the exact Production Convex deployment and reserved the GitHub merge for themselves. That backend deployment completed at `2026-10-23T14:27:26.222Z` on `outgoing-warbler-782`.

A dry run from `94ef195` matched all 348 existing function modules. The reviewed optimizations were then deployed from `c030476` on that matching baseline, not from the older master backport. Existing function contracts and HTTP routes remain unchanged; only `listClassOptions` was added. Convex also materialized six pre-existing staged indexes. A strict post-check flagged that difference, and read-only audit/index queries confirmed all six are backfilled but still staged. None were enabled or removed. No frontend deployment, provider write, environment-variable update, application-record migration or GitHub merge was performed.

The checkout is back on `perf/convex-egress-master`. PR #139 remains draft because the manually deployed Sites frontend has not been reconciled with master-triggered automatic deployments. Backend deployment is complete; frontend merge readiness is not. See `docs/tasks/ConvexOptimizationMasterBackport-20261023.md` for the exact deployment source, checks, staged-index findings and remaining hold.

## Owner-approved school Sites reconciliation
The owner clarified that the school's Sites frontend and required backend support should be retained. Only unrelated Melo marketing/landing-page work stays excluded. The next Build slice restores the already-reviewed maintained source from `94ef195` onto the existing optimization PR, rather than importing its full ancestry, which also contains raw launch photos and operator artifacts.

1. S1, architect through OpenCode DeepSeek, returns a read-only path manifest and conflict/verification plan.
2. S2, coder through OpenCode GLM, restores the approved maintained-source paths and runs focused checks in one write stream. Preserve optimization changes, all local launch artifacts, and existing release/review records.
3. S3, reviewer through OpenCode DeepSeek, reviews the combined branch, source parity and restored contracts. The parent handles release documentation, PR update and handoff.

No new feature design, marketing work, remote data writes, deployments, infrastructure changes or GitHub merge are authorized by this reconciliation. The owner will merge personally. Preview builds caused by an eventual PR source push are expected, but no manual frontend deployment is requested. Raw `deliverables/obhis-hosted-launch` files must remain outside the PR and its pushed ancestry.

## Reconciliation outcome and routing update

The 36 maintained-source paths are restored. The complete `apps` and `packages` trees match `c030476`, preserving the school's upkeep and optimizations while excluding marketing changes and private launch ancestry. The owner reported OpenCode quota exhaustion and explicitly switched remaining work to Takomi GPT models. OpenCode S3 was interrupted without a verdict; its unresolved observation was retained for the replacement round.

Takomi GPT-6.1 Sol completed S3 with REVIEW CLEAR, no findings and no restoration-path coverage gaps. No implementation correction was required. Parent verification records 94 passing focused tests, five passing typechecks and three passing frontend builds. The local TLS setup issue is resolved by process-local configuration. The existing Windows browser-bridge timeout and missing isolated QA profile remain open verification limits, so S2 validation is not marked complete.

The missing-Sites-source rollback risk is resolved. Publish the reviewed source and release records to PR139 as a draft update, with the browser limits stated. Do not merge or deploy. The owner retains the eventual merge decision. See `S2_implementation_report.md`, `S3_review_result.md`, and `docs/tasks/ConvexOptimizationMasterBackport-20261023.md` for the exact evidence and boundaries.
