---
name: verify-melo
description: Use when testing a Melo feature in a real browser, preparing an isolated QA worktree, or capturing review evidence. Covers role journeys and exploratory feature checks before claiming UI work complete.
author: OpenAI
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Verify Melo

Project-local command wrapper. Use the existing QA runner rather than constructing a new seed/reset workflow. Read the [feature map](features/README.md) first and the matching recipe before driving a feature.

## Doctor and launch

1. Work from the intended Git worktree. Read [QA authority](../../../docs/testing/AgentQaAuthority.md) and inspect `package.json` QA commands. Completion means the worktree and allowed backend are identified without revealing credentials.
2. Run `pnpm qa:doctor --apps admin,teacher,portal`. For a fresh checkout, configure the private profile using [setup](../../../docs/testing/AgentQa.md#setup). Doctor must attest the isolated school and origins. An occupied unrelated port or wrong target is a blocker; use the owner's environment as it stands rather than killing it or guessing another port.
3. Run `pnpm qa:start --apps admin,teacher,portal`, then `pnpm qa:doctor`. Completion means all selected origins are ready and owned by this worktree. The current runner supports three attested apps, not all seven.

## Drive the implemented feature

4. Run `pnpm qa:roles` for the baseline role journeys. For template-editor changes, also run `pnpm qa:feature`. For the graded result lifecycle, run `pnpm qa:workflow --script scripts/qa/school-workflow.mjs --allow-synthetic-writes`. Baseline checks are prerequisites, not substitutes for feature-specific acceptance.
5. List every relevant entry point and acceptance criterion from the task and feature map. Exercise the changed behavior through the UI: success, validation, cancellation, empty/loading/error states, applicable role denial, reload persistence, and mobile/keyboard paths. Mark an inapplicable criterion with its reason rather than inventing coverage. Completion means each relevant criterion has an observable assertion or a recorded blocker.
6. For a feature outside the built-in journeys, author a small worktree-contained module following [the exploration recipe](references/exploration.md). Run `pnpm qa:explore --role parent --script scripts/qa/explore-example.mjs` to prove the mechanism, then run the feature's own module with the correct role. Use `--allow-synthetic-writes` only for approved isolated synthetic-record changes. These are trusted scripts, not a security sandbox.
7. Inspect failures and the current DOM/ARIA rather than assuming a stale layout. Fix a confirmed local defect, rerun its criterion, and retain the failing evidence. For missing backend functions or provider prerequisites, use the authority/maintenance procedure or record blocked. Completion is verified behavior, not a green process exit or a screenshot alone.

## Evidence and cleanup

8. Run `pnpm qa:report`. Review the HTML scope/effect claims, acceptance outcomes, and checkout metadata, and review PNGs for sensitive content, and keep authenticated traces/videos/session data private. A passing legacy journey does not attest the backend source revision or every newly merged feature.
9. Publish reviewed screenshots and HTML with `pnpm qa:report --run <reported-run-id> --publish-reviewed`. Verify the returned Tailnet URL with HTTP 200. For PRs, link the report with its explicit scope and limits; publish raw video only through a separately reviewed path.
10. Run `pnpm qa:stop`, including after a failed attempt. Confirm owned ports/leases are released and the evidence remains. Keep run-marked inactive fixtures identifiable; preserve school data rather than calling generic cleanup. Completion means no owned process is stranded and proof survives teardown.

## Maintenance branches

- For a backend update, follow [exact-target maintenance](../../../docs/testing/AgentQa.md#backend-updates). Standing isolated approval does not weaken scope checks, index rollout order, or credential cleanup.
- For a new app or port, establish its server-side trusted origin, test fixture/account or published configuration, and ownership before expanding the runner. Frontend environment variables alone do not establish server trust.
- For a feature/UI change, update its map and assertions as part of that task. Preserve other entry points and coverage limits. The existing agent-engineering maintain-verification-skill recipe can guide a later audit; this utility does not duplicate a global suite or change Core Essentials.
