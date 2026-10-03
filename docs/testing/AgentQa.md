# Agent QA commands

## Purpose and current scope

These commands start this worktree against the verified synthetic school on `dev:content-poodle-172`. They do not call a seed, reset, purge, deployment, or environment-update command. Normal development and production are refused.

The supported origins are Admin `3102`, Teacher `3101`, and Portal `3103`. Startup selects these attested apps; the built-in role journey covers Admin, Teacher, and Parent. There is no claim of all-seven-app, provider, complete feature, or cross-tenant coverage. Standing isolated-development authority is recorded in [AgentQaAuthority.md](AgentQaAuthority.md). For agent execution, use the project-local [verify-melo skill](../../.agents/skills/verify-melo/SKILL.md).

## Setup

Run from the intended worktree, not from the main workspace:

```sh
pnpm install --frozen-lockfile
pnpm test:e2e:install
```

Copy `.env.qa.example` to the ignored `.env.qa.local`. Obtain the existing isolated deployment's operator token and identity privately. Keep them out of chat, commits, PR comments, screenshots, and shell command arguments.

An existing private profile can be referenced instead of copied:

```sh
pnpm qa:doctor --env-file /absolute/path/to/.env.e2e.local --apps admin
```

Doctor checks Node, pnpm, the installed Playwright browser, root and selected app target agreement, ports, and a dedicated inspection-only QA endpoint. It verifies original actor/cohort ownership plus retained marked fixtures; this is separate from destructive reset readiness, which remains unchanged. Before launch it requires free ports; for an already ready owned instance it verifies matching ownership/profile/apps and HTTP readiness instead of treating its own ports as a collision. It stores the profile path, not credentials, in the ignored `.qa/config.json`. Future commands reuse that path. Moving or deleting it makes the next check fail.

## Start, inspect, and stop

```sh
pnpm qa:start --apps admin,teacher,portal
pnpm qa:smoke
pnpm qa:layout
pnpm qa:feature
pnpm qa:roles
pnpm qa:explore --role parent --script scripts/qa/explore-example.mjs --run-trusted-module
pnpm qa:workflow --script scripts/qa/school-workflow.mjs --run-trusted-module --allow-synthetic-writes
pnpm qa:report
pnpm qa:stop
```

- `qa:smoke` checks protected routing, real Admin sign-in, and template workspace availability.
- `qa:layout` checks starter preview, title validation, desktop control containment, and mobile draft layout without saving templates.
- `qa:feature` additionally creates a uniquely named inactive subject-scoped template, reloads it, checks guidance and format persistence, exercises cancel/discard, saves an edit, and reloads on mobile. It does not activate templates, change the existing school default, or call AI. Teacher template resolution and generation need separate acceptance coverage before claiming the whole template feature is verified.
- `qa:roles` checks Admin grading draft/discard, Teacher dependent roster selection/reload/mobile and rejection from Admin editing, and Parent topic search/detail/mobile. Use `--roles teacher,parent` for a subset; Teacher's denial criterion also needs an owned Admin server.
- `qa:explore` runs a trusted worktree-contained module with a single declared role. The module exports scope, effects, and named executable acceptance steps. Review code before granting `--run-trusted-module`; a static literal effect check happens before import. Synthetic-write declarations additionally require `--allow-synthetic-writes`. Paths/digests are checked, and browser traffic is restricted to owned app origins, the isolated backend, and read-only public Google font CSS/files. This is not a Node/filesystem sandbox or an enforced guarantee about script side effects. See [the recipe](../../.agents/skills/verify-melo/references/exploration.md).
- `qa:workflow` supports ordered, uniquely named cross-role phases with dependencies and `alwaysRun` cleanup. The included school case uses a fresh fixture per run and verifies the full graded lifecycle. Role sessions are cached only in memory and independently validated before each phase. Post-run inspection checks original cohort preservation and the period observed before writes; a module cannot override that assertion with a declared target.
- `qa:stop` checks the exact supervisor owner before signalling it. It does not kill whatever happens to occupy a port.

A QA-owned supervisor starts each selected Next.js app in this worktree with explicit isolated cloud/site URLs. Operator secrets are not forwarded to frontend processes. App logs remain private in `.qa/`.

Use `qa:start --apps admin,teacher,portal` to start all three attested apps. Port reservations are exclusive across worktrees on this Mac. Occupied trusted ports fail rather than borrowing an existing server or picking an untrusted origin. An additional port needs separately verified server-side auth configuration, not just a frontend `.env` change.

Browser runs take a local backend lease to prevent simultaneous QA fixture changes. This does not coordinate separate machines, manually opened browsers, or commands outside this runner.

## Evidence

Each run has a unique directory under `.qa/runs/`. The result manifest records passed, failed, blocked, and skipped checks. Built-in role plans declare all criteria before driving a role, so interruption also records pending criteria for roles not yet started. Setup/report failures release the backend lease. Backend contract drift is reported as blocked; ordinary QA does not deploy to fix it.

Reports include the checkout revision, upstream ref observed at run time, and a dirty-source flag. Preflight does not attest a deployed source revision, so that field remains unverified instead of guessing a match. An exploratory effect declaration is reported as a declaration, not an independently enforced guarantee.

Screenshots and an HTML summary are available locally. Trace ZIPs, raw console errors, raw assertion text, and videos stay private. Authentication happens before tracing and video capture; the browser session snapshot stays in memory. Traces may still contain authenticated network data, so they are never copied to the share.

Review the HTML scope, effect declarations, outcomes, and each screenshot for sensitive content before publishing:

```sh
pnpm qa:report --run qa-<run-id> --publish-reviewed
```

This explicitly reviewed publication copies only HTML and listed PNG screenshots to `~/tailscale-share/melo-agent-qa/<run-id>/`. It does not publish raw videos, traces, logs, profile paths, credentials, or session state. The existing private Tailnet share serves the result. The Mac must remain awake and connected. A second publication refuses to overwrite an earlier report.

Video sharing and PR attachment automation are later steps. A video being captured is not permission to publish it.

## Interrupted runs

Ordinary failed phases run declared cleanup. A hard interruption/timeout may stop before UI cleanup; it records a recovery marker and all pending criteria as blocked. Normal browser runs then refuse to continue until doctor independently verifies the recorded original period and cohort digest, or an explicit recovery workflow succeeds:

```sh
pnpm qa:workflow --script scripts/qa/recover-calendar.mjs --run-trusted-module --allow-synthetic-writes --recovery
```

The recovery target comes from the interrupted run's recorded preflight, not a script-supplied override. Restore only through UI; retain partial fixtures and evidence. A network failure during post-run inspection cannot become a preservation claim.

Leases are never stolen automatically. If an owner crashed, examine `.qa/state.json`, the owner command/PID, listening ports, and lease metadata under the OS temporary directory before manual recovery. Do not use a blanket port-kill command. A live browser backend lease blocks `qa:stop`; let that run finish first. Restarting a worktree does not imply the remote fixture was cleaned up.

Inactive QA templates remain marked by their run ID. No generic purge or automatic cleanup is performed. Avoid repeatedly creating fixtures once a backend mismatch is known. A failed save may be ambiguous if its response was lost; inspect for the run marker before retrying that operation.

## Backend updates

A backend update uses the maintenance procedure under the owner's [standing isolated authority](AgentQaAuthority.md). Ordinary QA commands do not deploy, and production/normal-dev writes remain outside scope. In Convex CLI 1.34.1, a project-scoped `CONVEX_DEPLOYMENT` selector can resolve to the user's default dev deployment instead of the deployment name written in an env file. The CLI authorization endpoint also returns the broad login token, which can access both development backends; it is not a deployment-specific credential.

Use the management API's documented `create_deploy_key` endpoint for `content-poodle-172` with a named, short-lived key and limited deployment permissions. Keep its value in a private ignored profile containing one unquoted literal `CONVEX_DEPLOY_KEY=<key>` assignment and optional blank/comment lines. Additional lines, colon assignments, duplicates, and other dotenv syntax are refused rather than silently skipped. OAuth-derived keys may reuse a broad grant, so test scope rather than trusting a name or prefix alone.

The maintenance-only `scripts/qa/deployment-target.mjs` helpers reject other targets, project selectors, URL overrides, and broad unprefixed credentials. They attest the key through protected configuration reads: it must succeed on the isolated cloud URL and receive an authentication denial on normal development. A network failure is not scope proof. These helpers do not mint keys or push code.

Before an approved push, use the installed CLI's `dev --once --skip-push --codegen disable --env-file <private deployment-key profile>` path, and verify the effective cloud/site URLs and deployment name written in this worktree. Keep credentials out of CLI argument values. Then perform the one-shot push using the same verified profile, with typecheck enabled, codegen disabled, and no `--run` step. Capture code/schema fingerprints for normal development before and after to establish that the corrective operation did not change it. Revoke the temporary key afterward and confirm that it is denied. Revocation can have a brief access-cache delay; poll protected metadata read-only, and treat an already-removed key as cleaned up only when access is denied.

For staged-index activation, verify the isolated index is actually backfilled, not just declared in source. `stagedIndexReady` accounts for Convex's implicit `_creationTime` ordering suffix while checking the exact logical fields and staged/backfill state. Keep separate staged indexes staged unless their own readiness and rollout are established.

This procedure succeeded for the first milestone. See [the verification and incident record](AgentQaVerification.md). Preserve the distinction between correcting the isolated backend and establishing the full effects of the earlier normal-dev incident.

## Offline verification

```sh
pnpm qa:test
pnpm exec eslint scripts/qa/*.mjs
```

The safety tests use temporary folders and local sockets, not cloud credentials. They cover target refusal, profile parsing, occupied ports, lease ownership, frontend secret exclusion, supervisor identity, evidence escaping, and truthful result states.
