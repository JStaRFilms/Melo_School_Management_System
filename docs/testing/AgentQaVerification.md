# Agent QA milestone verification

Date: 2026-09-29.

Status: tooling and non-writing browser proof verified; persistent feature workflow blocked. A separate deployment-target incident requires review before further cloud writes.

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
| `pnpm qa:test` | 12 offline tests passed. |
| Targeted ESLint | QA scripts and touched template components passed. |
| Admin template unit tests | 2 files, 10 tests passed. |
| Admin typecheck | Passed. |
| Convex typecheck during the separately approved deployment attempt | Passed, but the effective deployment was wrong; this is not a successful isolated deployment. |
| `git diff --check` | Passed. |
| Theme audit | Informational; existing amber validation/warning and emerald/rose status colours remain semantic. No new direct colours introduced. |
| QA doctor | Live target attested as `content-poodle-172`, Demo Academy; 36 students, 3 classes, 36 invoices, 756 assessment records. |
| Owned server start/stop/restart | Passed; unrelated WWW listener on 3100 retained. |
| Browser smoke | 4/4 checks passed. |
| Layout regression | Failed before fix at 1440px: scope control right edge was 1488.1875px. Passed after local fix. |
| Final desktop/mobile layout | 8/8 checks passed, no browser errors. |
| Full inactive-template lifecycle | Blocked: 6/12 checks passed, 6 blocked. The deployed test validator rejects `formatHint`; no successful test-template write observed. |

The authenticated test sessions were created on the isolated backend. No seed/reset/purge was invoked by QA. No production operation was performed.

## Evidence

- Passing smoke run after the final direct-run ownership guard: `qa-1790722864901-a1e7c247`.
- Passing layout run: `qa-1790722567455-21aaeadc`.
- Blocked feature run: `qa-1790722585657-ee5f30a1`.
- Original failing layout run: `qa-1790722278742-a2ed27b0`.

Private artifacts are under `.qa/runs/`. Authentication is excluded from the latest videos and traces; authenticated traces still remain private. Reviewed screenshots and HTML were published, not raw logs, videos, traces, or session state.

- [Passing layout evidence](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790722567455-21aaeadc/index.html)
- [Blocked feature evidence](https://macbook-air-2.tailb6e2d3.ts.net:3420/melo-agent-qa/qa-1790722585657-ee5f30a1/index.html)

Both URLs returned HTTP 200 with HTML content type. They require Tailscale access and this Mac online.

## Deployment-target incident

The owner explicitly approved updating only the isolated `content-poodle-172` code/schema, without resetting or reseeding. The agent ran a preflight that proved that isolated target, then invoked installed Convex CLI 1.34.1 `dev --once --typecheck enable --codegen disable --tail-logs disable --env-file <existing isolated profile>` from this testing worktree.

Despite that profile's `CONVEX_DEPLOYMENT=dev:content-poodle-172`, the development CLI selected the user's normal development deployment `scrupulous-chinchilla-25`. It wrote a new `.env.local` in this worktree and pushed the current committed backend code/schema there. Its output reported the new index `knowledgeTopics.by_school_and_subject_and_status`. This was outside the approved target and was an agent error. A prior snapshot of the normal deployment's function versions was not captured, so the full previous-versus-current backend delta is not established.

The agent immediately disclosed the target mismatch and stopped cloud writes. Read-only `function-spec` queries with an explicit deployment name returned the expected URL for each backend. They confirmed that the isolated validator still lacks `formatHint`/`guidance`, while the normal development validator now includes them.

The CLI's source shows that a project-scoped `CONVEX_DEPLOYMENT` selects a project and can choose the user's default development deployment. The inspected remote target did not bind the separate CLI's effective deployment credential. That preflight was insufficient protection for a push.

No seed/reset/purge or migration function was run. No production deployment was run. Code/schema on normal development did change; this record does not claim that normal development was untouched or that all consequences have been verified. No automatic rollback was attempted because the previous deployed state is not established.

The newly generated wrong-target `.env.local` was moved to private `.qa/incident-cli-created-env.local`. The main workspace and other worktree environment files were not edited. The QA app process still uses explicit isolated URLs. All further deployment commands are paused pending review.

## Required follow-up

1. Review the normal development code/schema change and decide whether any remediation is needed. Do not reset it or invent a prior state for rollback.
2. Establish a deployment-specific development credential or another supported exact-target deployment path. Prove both the effective credential's deployment name and its server URL before any push. A profile's selector alone is insufficient.
3. Update only the isolated test backend under that exact proof, without reseeding, then rerun the save/reload/edit/discard workflow.
4. Extend acceptance coverage to teacher resolution, permissions, keyboard access, activation, and generation with separately configured provider limits. The current editor journey is not full verification of the complete instruction-template feature.
5. Add broader app-origin inspection, controlled run-scoped fixtures, reviewed video publication, an agent skill built on the validated commands, and CI as later milestones.
