# Agent QA first milestone

## Goal

An agent can launch this worktree against the existing isolated Convex deployment, use a real browser to check a feature, and provide reviewable evidence. A passing unit test or a screenshot of a loaded page is not complete feature verification.

## Approved scope

- Target: `dev:content-poodle-172`, `https://content-poodle-172.eu-west-1.convex.cloud`.
- The normal development deployment and production are out of scope.
- Inspection, test sign-ins, and synthetic test records are permitted. No seed, reset, purge, schema deployment, or server environment change is part of ordinary QA.
- Payment tests use provider test mode. Email recipients and live AI spending limits must be configured before those integrations run. Credentials alone do not establish these limits.
- Worktree: `Melo_School_Management_System-testing`; branch: `feat/agent-testing-environment`.

## Deliverables

1. `qa:doctor`: dependencies, exact target proof, selected ports, app environment consistency, browser availability, and backend readiness.
2. `qa:start` / `qa:stop`: start selected apps in this worktree, record ownership, reserve ports across worktrees, and stop only owned processes.
3. `qa:smoke`: browser checks with an independent configuration that cannot invoke seeding or reset setup.
4. `qa:feature`: an authenticated template workflow, with validation, save/reload, edit/discard, and narrow-screen checks where backend support permits.
5. `qa:report`: evidence manifest and HTML report with distinct passed, failed, skipped, and blocked states. Raw traces and session artifacts stay private.
6. Offline tests for target refusal, origin policy, profile parsing, process ownership, evidence escaping, and command argument validation.

## Safety and concurrency

The initial live proof uses Admin, Teacher, and Portal origins already attested by the server. Ports are reserved rather than blindly borrowed. If a known trusted port is occupied, the runner reports a blocker. Arbitrary new ports require separate server-side origin verification; the runner does not edit `TRUSTED_ORIGINS` automatically. Support for all seven apps is staged, not a claim made by the first proof.

Different frontend worktrees still share one test database. Browser runs take a backend lease to prevent conflicting fixture edits. A later extension can introduce run-scoped fixtures and stronger cross-machine coordination. Local leases protect this Mac only.

All feature writes use a unique QA marker and inactive/non-default templates. They must not replace existing active templates. Records created by a run remain identifiable for later reviewed cleanup; QA does not call generic purge or reset.

## Evidence and completion

Capture desktop and mobile screenshots, browser errors, and an explicit acceptance checklist. Record what failed or could not run. A feature run must exercise its relevant acceptance criteria, not just navigation. The first workflow is a demonstration, not complete coverage of all features or providers.

Publish only reviewed evidence to the private Tailnet share. Passwords, input values, session state, raw traces, and raw videos are private by default. Sharing to a PR is a separate reviewed publication step.

## Implementation order

Build the commands and offline safety tests, run doctor, launch the selected apps, attempt the live authenticated workflow, classify blockers or fix confirmed local defects, rerun, then publish a sanitized report. Retain evidence of an unsuccessful attempt rather than claiming success or forcing a backend deployment.

An agent skill and CI integration follow working command validation. This milestone does not install a global skill or change harness configuration.
