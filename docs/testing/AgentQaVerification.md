# Agent QA milestone verification

Initial proof: 2026-09-29. Corrective verification completed 2026-09-30 UTC.

Status: the bounded first milestone is verified, including persistent inactive-template creation, reload, edit/discard, and mobile checks. The historical deployment-target incident remains recorded below; its complete prior-state delta is not reconstructed.

## Implemented

- QA doctor/start/stop/smoke/layout/feature/report commands.
- Exact isolated target checks, app target agreement, occupied-port refusal, local port and backend leases, owned supervisor shutdown, and frontend environment allowlisting.
- Browser sign-in, protected-route check, starter preview, title validation, desktop control containment, and mobile draft checks.
- A save/reload/edit/discard workflow whose unexercised criteria remain blocked when the backend contract is incompatible.
- Private screenshot/video/trace capture and opt-in publication of reviewed HTML/PNG evidence to Tailscale.
- A local fix for the template editor's desktop clipping. Parameters now stack below the editor at narrower desktop widths; the header can wrap its statistics rather than extending beyond its content area.

No global agent skill, CI workflow, provider test adapter, arbitrary-port server-origin update, or all-seven-app coverage was installed.

## Checks

| Check | Result |
| --- | --- |
| `pnpm qa:test` | 16 offline tests passed, including 4 exact-credential maintenance tests and strict profile-file parsing. |
| Targeted ESLint | QA scripts and touched template components passed. |
| Admin template unit tests | 2 files, 10 tests passed. |
| Admin typecheck | Passed. |
| Convex typecheck | Passed during both attempts. The first targeted the wrong backend; the later approved, credential-bound attempt successfully updated only the isolated backend. |
| `git diff --check` | Passed. |
| Theme audit | Informational; existing amber validation/warning and emerald/rose status colours remain semantic. No new direct colours introduced. |
| QA doctor | Live target attested as `content-poodle-172`, Demo Academy; 36 students, 3 classes, 36 invoices, 756 assessment records. |
| Owned server start/stop/restart | Passed; unrelated WWW listener on 3100 retained. |
| Browser smoke | 4/4 checks passed. |
| Layout regression | Failed before fix at 1440px: scope control right edge was 1488.1875px. Passed after local fix. |
| Final desktop/mobile layout | 8/8 checks passed, no browser errors. |
| Full inactive-template editor lifecycle | Latest run passed 12/12 checks with no browser errors. Earlier 6/12 blocked evidence is retained. |
| Scoped maintenance credential | Limited, two-hour test key created; isolated access verified, normal-development access denied; CLI skip-push resolved to the exact isolated target. |
| Normal-development fingerprint comparison | Code/config and active schema unchanged during the corrective isolated push and browser test window. This does not undo or erase the earlier incident. |
| Credential cleanup | Temporary test deployment key revoked, access denial verified, private credential profile removed. |

The authenticated test sessions and one run-marked inactive subject-scoped template were created on the isolated backend. Its existing active school-default template was not replaced. The cohort still has 36 students, 3 classes, 36 invoices, and 756 assessments. No seed/reset/purge or production operation was performed.

## Evidence

- Passing smoke run after the final direct-run ownership guard: `qa-1790722864901-a1e7c247`.
- Passing layout run: `qa-1790722567455-21aaeadc`.
- Latest passing feature run: `qa-1790729185913-14efb098`.
- Earlier blocked feature run: `qa-1790722585657-ee5f30a1`.
- Original failing layout run: `qa-1790722278742-a2ed27b0`.

Private artifacts are under `.qa/runs/`. Authentication is excluded from the latest videos and traces; authenticated traces still remain private. Reviewed screenshots and HTML were published, not raw logs, videos, traces, or session state.

- [Passing layout evidence](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790722567455-21aaeadc/index.html)
- [Earlier blocked feature evidence](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790722585657-ee5f30a1/index.html)
- [Completed editor workflow evidence](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790729185913-14efb098/index.html)

All three URLs returned HTTP 200 with HTML content type. They require Tailscale access and this Mac online.

## Deployment-target incident

The owner explicitly approved updating only the isolated `content-poodle-172` code/schema, without resetting or reseeding. The agent ran a preflight that proved that isolated target, then invoked installed Convex CLI 1.34.1 `dev --once --typecheck enable --codegen disable --tail-logs disable --env-file <existing isolated profile>` from this testing worktree.

Despite that profile's `CONVEX_DEPLOYMENT=dev:content-poodle-172`, the development CLI selected the user's normal development deployment `scrupulous-chinchilla-25`. It wrote a new `.env.local` in this worktree and pushed the current committed backend code/schema there. Its output reported the new index `knowledgeTopics.by_school_and_subject_and_status`. This was outside the approved target and was an agent error. A prior snapshot of the normal deployment's function versions was not captured, so the full previous-versus-current backend delta is not established.

The agent immediately disclosed the target mismatch and stopped cloud writes. Read-only `function-spec` queries with an explicit deployment name returned the expected URL for each backend. They confirmed that the isolated validator still lacks `formatHint`/`guidance`, while the normal development validator now includes them.

The CLI's source shows that a project-scoped `CONVEX_DEPLOYMENT` selects a project and can choose the user's default development deployment. The inspected remote target did not bind the separate CLI's effective deployment credential. That preflight was insufficient protection for a push.

No seed/reset/purge or migration function was run. No production deployment was run. Code/schema on normal development did change; this record does not claim that normal development was untouched or that all consequences have been verified. No automatic rollback was attempted because the previous deployed state is not established.

The newly generated wrong-target `.env.local` was moved to private `.qa/incident-cli-created-env.local`. The main workspace and other worktree environment files were not edited. Further deployment commands were paused until the owner approved the review and exact-target correction in the next turn.

## Reviewed corrective operation

Normal development was reviewed through read-only schema, function-argument metadata, and code/config fingerprints. The reported topic index is declared in the committed upstream backend; the current schema has 181 tables and the root API has 683 functions. No prior normal-dev deployment snapshot was available, and no rollback or additional write to normal development was attempted. This is a bounded metadata review, not a claim that every real-tenant workflow was exercised.

The CLI authorization endpoint was tested and found to return the same broad login token for both development deployments. That token failed the scope gate and was never used by the corrective push. Using the documented management API, the agent created a uniquely named development deploy key for `content-poodle-172`, limited to deployment and required read/inspection permissions, with a two-hour expiry. It was kept in an ignored mode-0600 profile, never in command-line values, logs shared to the owner, or commits.

Protected configuration reads proved that the new key worked on the isolated URL and was denied on normal development. `convex dev --once --skip-push --env-file <private key profile>` then selected `dev:content-poodle-172` and the exact cloud/site URLs. The one-shot code/schema push used that same profile with typecheck enabled, codegen disabled, and no seed, reset, `--run`, or environment-update step. It added the expected topic index and the `schoolEnrollmentCounts.by_school` index. The synthetic cohort was retained.

Code/config and active-schema fingerprints on normal development matched before and after this corrective operation and the browser workflow. Only isolated backend code/schema changed during this window. Those checks do not reconstruct or erase the previous incident.

The deployed Convex and AI source matched the committed baseline `c6549ee`; no backend-source changes were authored by this QA branch. Upstream advanced independently while the milestone ran. Those later features were not merged or redeployed by this operation, so this report verifies the recorded baseline and editor scope, not every feature on the newer upstream tip.

The browser then passed all 12 editor-lifecycle checks, including successful save, reload, field persistence, cancel/discard, subsequent edit/save, and mobile reopening. One inactive fixture remains identifiable by `QA qa-1790729185913-14efb098`; no generic cleanup was performed. The temporary deployment key was revoked afterward, authenticated access was confirmed denied, and its private profile was removed. Independent review identified a parser mismatch risk in the reusable maintenance helper; its file reader now accepts one literal assignment only, with regression tests for colon syntax, duplicate keys, and ignored settings. The actual maintenance profile used for the successful push contained just the generated single key assignment. Routine QA continues to use the separate inspection-only operator gate and synthetic user sign-in.

## Remaining follow-up

1. Retain the incident record and the limit of the normal-dev metadata review. Investigate any real-tenant regression separately without inventing a prior state for rollback.
2. Extend acceptance coverage to teacher resolution, permissions, keyboard access, activation, and generation with separately configured provider limits. The current editor journey is not full verification of the complete instruction-template feature.
3. Integrate newer upstream changes in a separate reviewed pass, and record frontend/backend code revisions in future QA evidence.
4. Add broader app-origin inspection, controlled run-scoped fixtures, reviewed video publication, an agent skill built on the validated commands, and CI as later milestones.
