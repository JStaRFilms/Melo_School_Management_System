# Task S2: Restore maintained school Sites source

## Agent setup
### Workflow to follow
Takomi Build, canonical coder persona. Owner preference is OpenCode GLM for bounded implementation. This is restoration of existing reviewed source, not a feature redesign.
### Prime context
Read `AGENTS.md`, any more-specific guidance, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/orchestrator-sessions/orch-20261023-101453/S1_scope_result.md`, the current master plan, `docs/tasks/ConvexOptimizationMasterBackport-20261023.md`, relevant source/types/tests/package configs, and source-ref feature docs before editing. For browser QA read `.agents/skills/verify-melo/SKILL.md` and its authority links.

## Objective
Restore the exact approved 36-path school Sites manifest from `c03047629d09e206113ecb6a2ffd01ca3384a784` into `perf/convex-egress-master`, retaining the query/read optimizations and keeping raw launch artifacts and unrelated marketing work out of PR139.

## Scope
Use exactly the manifest in `S1_scope_result.md`. Inspect the archived versions with Git before restoring. Preserve current parent-authored session/release documents and all unrelated work. Source restoration must use `c030476`, not plain `94ef195`, because the former includes the optimized `shared.ts`. Restore the original Sites optimization fixture now that its actual contracts return. Deletion of the obsolete static `apps/sites/app/icon.png` is intentional and required for tenant favicon selection.

Use `git --literal-pathspecs restore --source=<ref> --staged --worktree --pathspec-from-file=<manifest>` or similarly bounded per-group commands after checking target paths for unexpected changes. A new manifest under ignored `tmp/sites-reconciliation-20261023/` is fine. Do not merge/cherry-pick original ancestry. Do not restore whole top-level directories.

## Constraints
- One source-writing agent. No further delegation, commits, pushes, GitHub edits/merge, rebase or squash. Parent owns review, commits, PR updates and user handoff.
- No Production, Preview or normal-dev backend/frontend deployment, remote data/config writes, credential access, provider actions, raw photo publication, or execution of operator scripts.
- Preserve `deliverables/obhis-hosted-launch/**` as it stands, untracked/unpushed. Exclude historical task sessions from Oct 12/16, `apps/www`, and unrelated root `public`.
- Preserve optimization-owned academic functions and tests, four Admin academic consumers, onboarding retry tests, and existing review history. `functions/sites/public.ts` already matches the source ref.
- No cleanup, new abstractions, dependency updates, generated remote codegen, automatic index activation, migrations or seed/reset commands. Existing schema/API declaration restoration is source parity with the already deployed backend, not a new rollout.
- Run tests/builds sequentially. Do not kill unrelated processes. Before a build that clears `.next`, establish the affected app has no live server using that cache, or report the build blocked.
- QA is currently blocked by missing `.env.qa.local`; the stock CLI also silently no-ops on Windows. Parent verified this via exported `main`. Do not fix that unrelated runner or claim browser acceptance. No QA server was started.

## Verification
First prove restored manifest parity with `c030476`, and prove academic optimization source/consumers are unchanged from the starting HEAD.

Run the following focused checks, adapting only paths to actual installed package configs:
1. `pnpm --filter @school/convex exec vitest run functions/sites functions/academic/__tests__/classOptions.test.ts functions/academic/__tests__/archiveRecords.optimization.test.ts --testTimeout 20000`. Inspect tests for external effects before running; these must be in-memory/mocked, not cloud tests.
2. `pnpm --filter @school/shared exec vitest run src/site-manifests.test.ts`.
3. Admin local Vitest with its established config for `__tests__/site-management.test.tsx`, `__tests__/site-logo-copy.test.ts`, and `__tests__/student-onboarding-retry.test.tsx`.
4. Platform local Vitest for `__tests__/site-ownership.test.tsx`.
5. `pnpm --filter @school/sites exec vitest run core/olive-public.test.tsx`.
6. Direct typechecks for `@school/convex`, `@school/shared`, `@school/admin`, `@school/platform`, and `@school/sites`.
7. Sites, Admin and Platform production builds after checking process/cache ownership. No frontend deployment.
8. Informational `node scripts/audit-theme-colors.mjs`. Classify touched colors as tenant, semantic, neutral or print-only; do not replace colors globally.
9. `git diff --check`, full staged path inspection, and explicit zero diff for `apps/www`, root `public`, and launch deliverables against starting HEAD.

If a real check fails, diagnose the narrow cause. Do not weaken assertions, change unrelated code, fix a pre-existing issue, or present a blocked/incomplete check as passed. Restore known source first; report any additional correction needed to the parent.

## Definition of done
- All 36 paths match the approved `c030476` source, including the intentional icon deletion.
- Backend/shared/Sites and targeted Admin/Platform source preserve live upkeep plus optimizations.
- No excluded artifact content or ancestor commit imported.
- Focused checks run with exact outcomes and any genuine blocker recorded.
- Parent receives a concise inventory, commands/results/counts, parity evidence and remaining risks. No commit or push by this agent.

## Expected artifacts
Restored maintained files, plus `docs/tasks/orchestrator-sessions/orch-20261023-101453/S2_implementation_report.md` containing actual verification results and exclusions. Keep raw logs under ignored `tmp/sites-reconciliation-20261023/`.

## Dependencies and review checkpoint
Depends on approved S1 scope. Parent will inspect the diff and commission one independent read-only S3 review before committing and updating the PR.
