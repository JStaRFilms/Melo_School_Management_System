# Master release reconciliation

## Current scope after owner clarification

The owner clarified that the school's Sites frontend and its required backend support belong in this release. Only unrelated Melo marketing-page work stays excluded. The earlier optimization-only exclusion was too broad. The sections below retain that earlier history; they do not describe the current restored source.

The approved 36 maintained-source paths have now been restored from `c03047629d09e206113ecb6a2ffd01ca3384a784`, which combines the original school upkeep with the reviewed optimizations. The entire `apps` and `packages` trees now have zero diff from that preserved source. Academic optimization source and its Admin consumers remain unchanged from `eb30018`.

This restores tenant favicon/manifest behavior, school image-alt handling, Admin logo-copy and approval controls, Platform domain ownership controls, shared publication contracts, and matching Convex capability/approval/domain/schema/API support. The original Sites optimization fixture has also returned because its original contracts are present again. No new application behavior was invented to make checks pass.

There is still no `apps/www` or root `public` diff against master. Raw `deliverables/obhis-hosted-launch` files remain untracked and are not imported into the release history. Source was restored by an explicit literal path manifest, not by merging the original ancestor containing school photos and operator artifacts.

The source mismatch that threatened to overwrite the live Sites upkeep is fixed. The restored backend matches the source used for the authorized Production deployment, so this Git reconciliation does not require another backend deployment. No new Production frontend/backend deployment, provider write or GitHub merge has occurred.

Current verification includes 94 distinct passing focused tests, five direct typechecks, three affected frontend builds, source-parity/exclusion checks and the informational theme audit. The existing browser-bridge fixture still times out on Windows, including before restoration; it is not reported as passed. All six local TLS tests pass with a process-local OpenSSL configuration. Isolated-backend browser acceptance remains blocked by the missing private QA profile. Tests and timeouts were not changed to hide those limits.

The interrupted OpenCode review is not a pass. After the owner switched remaining work to Takomi GPT models, GPT-6.1 Sol independently reviewed all 36 restored paths and their integration and returned REVIEW CLEAR with no findings. Exact coverage and limits are in `docs/tasks/orchestrator-sessions/orch-20261023-101453/S3_review_result.md`.

The reconciliation is ready to publish as a reviewed draft PR update. The original missing-Sites-source rollback risk is resolved. The draft now retains only the documented browser verification gap, not an exclusion of the school's work. The owner still controls the eventual merge. No Production deployment or GitHub merge is part of this update. The preserved backend deployment and original review history below remain valid records of their respective stages.

## Initial optimization-only scope

The original review used local master `94ef195` as its base. A release preflight found remote master was still `d2ba632a09776e43684a99b4739885974790e094`. The extra local commit contained 78 unrelated Sites, schema and launch-asset files. The owner selected an optimization-only PR and a merge/deployment hold, and subsequently reiterated that main landing-page work must stay out.

Clean release branch `perf/convex-egress-master` starts from that remote master, not from `94ef195`. It cherry-picks only:

- `a2fd2f0` as `aaebc4f`, the query/read optimizations and their tests/evidence.
- `c030476` as `9ed916f`, the local review records.

The original `perf/convex-egress-evidence` branch and local master remain intact. No rebase, force push or unrelated commit inclusion was used.

The runtime-code changes in this PR remain the compact class-options API and four Admin consumers, conditional archive history reads, and transaction-local reuse of approved assets in Convex Sites resolvers. There are no main landing-page/public-site frontend changes, renderer changes, launch assets, schema/index changes, shared-manifest changes or domain-maintenance cadence changes. In particular, `apps/www`, `apps/sites`, `public`, `deliverables`, `packages/convex/schema.ts` and `packages/shared/src/site-manifests.ts` have no diff against remote master.

## Compatibility adjustment

The original Sites optimization test fixture depended on optional favicon registration, persistent domain-proof markers and indefinite approval fields from the excluded commit. The production optimization itself did not depend on those additions.

Only our new test fixture was adjusted to use the existing master contract: dated approvals/rights, a dated domain proof, one hero asset and two social-share assets. Its assertions for identical responses, fewer read occurrences, child consent, revocation, expiry, tenant ownership, kind and fifteen-minute freshness are unchanged. No production contract or schema was added to make the test pass.

The original evidence report and independent reviewer ledger remain historical records of the earlier base, not a claim that the original broader-base checks were rerun unchanged on this backport. This document records the backport's actual checks.

## Checks on the master backport

Passed:

- Backend typecheck.
- Admin typecheck.
- Thirteen focused backend files, 58 tests, using `--testTimeout 20000`.
- Four Admin files, 25 tests.
- Admin production build.
- ESLint on the adjusted Sites optimization test.
- Informational tenant-color audit against `origin/master`. Existing amber warning and emerald readiness colors remain semantic, unchanged.
- `git diff --check` and explicit excluded-path diff inspection.

The first backend run had 57 passes and one existing Olive publication test exceed its default five-second limit. No assertion or test-file timeout was changed; rerunning with a twenty-second CLI budget passed all 58 tests. A thirty-second lint command also timed out; the longer-budget rerun passed. These first attempts are not reported as passes.

Representative backport measurements retain class response bytes 6,367 to 1,303 and document-read occurrences 703 to 31. The compatible three-asset Sites fixture returns 1,338 response bytes unchanged, with legacy-equivalent page read occurrences 38 to 23 and requested-asset occurrences 27 to 22. They remain synthetic returned-document/JSON proxies, not production billing or measured production savings.

## Initial release hold

This PR is prepared as a draft under the owner's optimization-only selection. It is not merged or deployed as part of preparing the backport.

Convex deployment replaces an application bundle; it is not an isolated upload of one changed function. Remote master's Sites schema and approval/domain behavior are older than the separately maintained local release baseline. Before any Production push, establish the actual deployed source/schema and prepare a deployment whose effective delta contains only the reviewed optimizations, preserving existing deployed Sites behavior. Do not deploy the older master snapshot over newer production features merely because this PR has a narrow Git diff.

Before merging to master, also check automatic frontend deployment effects against the actual production baseline. The new `listClassOptions` function must be registered on exact Production `outgoing-warbler-782` before the updated Admin frontend is released. Do not change main-site frontend deployment settings or trigger a rollback of unrelated live pages to force this through.

There is no production savings claim, final Vercel preview pass or live/browser acceptance for this backport. The owner's later conditional permission to include safe prior work was not used because the narrow PR was feasible, and it did not override the exclusion of main landing-page work.

## Authorized Production backend deployment

The owner subsequently authorized deploying the Convex backend and reserved the GitHub merge for themselves. The backend deployment completed on `outgoing-warbler-782` at `2026-10-23T14:27:26.222Z`. No frontend deployment, GitHub merge, provider write or environment-variable update was performed.

The deployment did not use this older master backport as its full backend source:

- Exact deployment identity, project `1860901`, team `428903` and canonical URL `https://outgoing-warbler-782.eu-west-1.convex.cloud` were verified before access.
- A dry run from `94ef19516927abbfdf5a7b17f540022b1af66ee7` matched all 348 existing function modules. This established the actual live function baseline rather than inferring it from remote master.
- The deployment source was `c03047629d09e206113ecb6a2ffd01ca3384a784`, the reviewed optimization branch on that matching baseline. Relative to the baseline, it changes four production source files and adds focused tests. It does not deploy the frontend files present in that branch.
- Baseline and candidate schema bundle hashes were identical. Static app/component definitions, auth configuration, HTTP routes and cron definitions also matched. Analysis preserved all 811 existing query, mutation and action signatures and added only `functions/academic/academicSetup.js:listClassOptions`.
- The native Convex CLI completed successfully. Its start, schema-wait and finish requests returned HTTP 200. The actual push was guarded against a different code request, changed auth configuration, changed HTTP/cron definitions or changed function contracts after preflight. Native backend typechecking ran during preflight and deployment. The earlier full test suites were not rerun in this deployment step.

Post-deployment metadata confirms 812 registered queries, mutations and actions, with no removed or changed existing signatures. All 11 HTTP route entries remain unchanged. An anonymous request to the new query returns structured `ConvexError` data `Unauthorized`. The server redacts its error message, so the initial message-only probe was inconclusive; checking the structured error confirmed the expected denial. No authenticated school workflow or browser acceptance is claimed.

### Six staged indexes materialized during deployment

The dry run returned an empty finish diff and did not reveal six index additions. The strict post-deploy check stopped after the successful server commit when the actual finish response reported them. There was no deployment retry or automatic rollback.

A read-only deployment-audit query confirmed that these were existing `staged: true` declarations in the matching baseline schema, not new declarations in the optimization diff:

- `admissionsApplications.by_school_and_guardian_and_updated_at`
- `admissionsEntitlements.by_school_and_guardian_and_created_at`
- `admissionsPaymentEvents.by_school_and_provider_mode_and_provider_event_id`
- `admissionsRetentionJobs.by_state_and_scheduled_at`
- `issuedReportCards.by_classId_and_sessionId`
- `knowledgeOcrJobs.by_storage`

All six are backfilled and remain staged, not enabled. No index was removed, enabled or disabled. Document-schema validation, auth, cron definitions and function-server versions are unchanged in the deployment audit, including the Better Auth and rate-limiter components. No application records were rewritten or deleted, and no data-migration script ran. Do not describe this deployment as having zero index changes or treat an empty dry-run finish diff as proof of that.

The checkout was restored to `perf/convex-egress-master` after deployment. Local sanitized metadata and guard reports are under ignored `tmp/convex-optimization-deploy-20261023/`. Credentials stayed in process memory. The unrelated launch deliverables remain untracked and unpushed.

## Earlier frontend merge hold, resolved in source

PR #139 remains unmerged. The backend prerequisite for the new Admin query is satisfied, but merging master can still deploy frontend code automatically.

Read-only Vercel metadata confirms that `melo-sites`, rooted at `apps/sites`, is linked to this repository's `master` branch with automatic deployments enabled and no project ignore command. Its current Production deployment is `dpl_74xn9cnbjVdL5YDXnKhgE7vjMfK6`, a manual CLI upkeep build. Metadata records `baseCommit` as `d2ba632a09776e43684a99b4739885974790e094` and `upkeepSourceDigest` as `c8def46bf536203c411984b52a90ab4f09161d0b6b5cef73557eb721c0a8d956`. That digest matches the retained launch receipt in `94ef195`, which explicitly describes the upload as master plus reviewed local changes. It was not a clean master checkout. This backport deliberately excludes those Sites upkeep changes.

Keep the PR draft until the frontend release preserves those live upkeep changes or the owner separately approves an exact deployment-control change. An unchanged `apps/sites` Git diff alone does not prove that a master-triggered build preserves the manually deployed site. No frontend settings were changed to bypass this hold. Main landing-page work remains excluded.

Do not run a full Convex deployment from the older backport/master snapshot after merging. The live backend deliberately preserves newer, already-deployed Sites behavior. Any later backend release or rollback must retain that behavior. Roll the Admin frontend back before removing `listClassOptions`; do not enable or remove the six staged indexes as an unapproved follow-up.
