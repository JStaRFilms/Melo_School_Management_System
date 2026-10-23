# Convex optimization completion and local review

Implementation session `orch-20261023-101453` ran on branch `perf/convex-egress-evidence`, based on local master `94ef195`. The current checkout is the optimization-only backport `perf/convex-egress-master`.

## Delivered implementation

- Read-only metadata verified Production, copied-data Preview, normal development and synthetic QA identities. Aggregate October usage was refreshed without printing credentials or school records.
- Archive history datasets now load only when needed; archived material and referenced-topic reads are narrower.
- Four Admin option-only views use a compact class API instead of pupil/subject/teacher hydration.
- Sites public resolvers reuse approved assets within one transaction. Fresh authorization, child consent and domain readiness remain mandatory for every request.
- Focused synthetic evidence shows smaller class responses and fewer database read calls/document occurrences. No production saving is claimed from local measurements.

## Execution records

- G1, OpenCode DeepSeek read-only research: `node:delegated-task:command%3Amcp%3A2ceea6aa-4689-498a-82f3-924289b467e7%3Adelegate-task%3Amelo-egress-G1-deepseek-r1`.
- B1, OpenCode GLM archive implementation: `node:delegated-task:command%3Amcp%3A2ceea6aa-4689-498a-82f3-924289b467e7%3Adelegate-task%3Amelo-egress-B1-glm-r1`.
- B2 was concretely implemented by B5. B4, B5 and the parent focused review were bounded direct execution after the child writer ended. No concurrent source writes were used.

## Original local verification and limits

Seventy distinct backend tests and twenty-five Admin tests passed across focused runs. Backend, Admin and Sites typechecks passed; Admin and Sites builds passed. Changed-file ESLint has no errors and one existing warning. The theme audit and diff check were run. The initial cold baseline timeout passed on unchanged reruns.

No deployment, cloud data/configuration write, reset, migration, provider action or browser acceptance was performed. Preview is classified as prod by Convex, and the usage endpoints ignored deployment-name filters. Function data therefore cannot be attributed individually to outgoing-warbler from those tables.

The full [evidence report](../../ConvexOptimizationEvidence-20261023.md) contains raw aggregate measurements, reproducible synthetic comparisons, ranked remaining work and the exact separately approved rollout/rollback sequence. Deploy the additive backend before the new Admin frontend; roll the frontend back before removing the added query. Confirm exact targets rather than deployment type.

## Owner-requested independent local review

The owner authorized committing these changes and a local babysit-pr loop using an independent subagent with the branch-review skill. Scope is the complete branch against explicit base `94ef19516927abbfdf5a7b17f540022b1af66ee7`, including relevant working-tree changes. Review is read-only; findings must be verified before correction. Default is one consolidated review, a correction pass if needed, and final verification with the same finding ledger. T3 review rounds use new delegated tasks carrying the prior context, not messages to backing child threads.

This is not authorization to push, create a hosted PR/issue, fetch, merge, rebase, deploy or migrate. Code-ready and review-ready remain distinct from Preview, runtime and release readiness.

Implementation was committed as `a2fd2f05681196e0cb89fa3482051f19231f4d98`. R1 independently reported REVIEW CLEAR with no actionable findings and passed the two class-selector tests. R2 reconciled the 23-file inventory and confirmed source parity, but stopped with a progress summary. R3 also stopped before a final verdict. These two incomplete follow-ups are retained as blocked attempts, not counted as independent passes.

The parent completed the remaining archive/Sites test inspection and reran 9 focused tests successfully. No code defect or correction commit was needed. Local review is closed with no actionable findings, but a completed independent final coverage verdict is not claimed. Review tracking is committed separately without changing implementation. The [review ledger](branch_review.md) records exact task IDs, coverage, dispositions, checks and limits. No further reviewer launch is pending.

## Later authorized Production deployment

The owner subsequently authorized the Convex backend deployment and will merge the GitHub PR personally. Production `outgoing-warbler-782` was verified by exact project/team identity and canonical URL. Baseline `94ef195` matched all 348 existing function modules. The native CLI then deployed the reviewed optimization source `c030476` at `2026-10-23T14:27:26.222Z`, with backend typechecking enabled. No older-master backend rollback, frontend deployment or GitHub merge occurred.

Post-deployment metadata preserves all 811 existing query, mutation and action signatures and all 11 HTTP routes. Only `listClassOptions` was added. Its anonymous runtime probe confirms structured `ConvexError` data `Unauthorized`. Document-schema validation, auth configuration, cron definitions and function-server versions are unchanged.

The final deployment response also reported six additions absent from the empty dry-run finish diff. The strict post-check stopped after the server had successfully committed. Read-only audit and index metadata established that these are pre-existing staged schema declarations, all backfilled and still staged. No index was enabled, disabled or removed. There was no deployment retry, application-record rewrite, reset or data-migration script. The [backport release record](../../ConvexOptimizationMasterBackport-20261023.md) names the indexes and preserves this limitation of the dry run.

Backend deployment is complete. PR #139 remains draft and unmerged because `melo-sites` automatically deploys master, while its current manual upkeep build includes local changes excluded from the backport. Its recorded source digest matches the retained launch receipt, which explicitly identifies master plus reviewed local changes. No frontend/provider configuration was changed to bypass that hold. Existing launch deliverables remain untracked and unpushed. Production savings and authenticated/browser acceptance remain unmeasured.
