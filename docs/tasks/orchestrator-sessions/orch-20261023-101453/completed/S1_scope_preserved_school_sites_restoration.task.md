# Task S1: Scope the preserved school Sites restoration

## Agent setup
### Workflow to follow
Build reconciliation, read-only architecture pass. Use the Takomi architect persona through OpenCode DeepSeek, as requested by the owner for reasoning and review.
### Prime context
Read root `AGENTS.md`, `packages/convex/_generated/ai/guidelines.md`, `docs/tasks/ConvexOptimizationMasterBackport-20261023.md`, and the existing session master plan. Read additional scoped guidance before recommending changes.

## Objective
Identify the smallest maintained-source restoration that retains the live school's Sites upkeep in PR139 while preserving the Convex optimizations and excluding unrelated Melo marketing work.

## Scope
Compare current `perf/convex-egress-master` with preserved `94ef19516927abbfdf5a7b17f540022b1af66ee7` and `c03047629d09e206113ecb6a2ffd01ca3384a784`. Original remote-master baseline is `d2ba632a09776e43684a99b4739885974790e094`. The owner explicitly corrected scope: keep school Sites frontend and required backend support; exclude only unrelated Melo marketing-page work.

Return an exact file manifest covering Sites frontend, Admin/Platform Sites controls, shared publication contracts, matching Convex source/generated declarations, focused tests, and relevant feature/operations/QA docs. Identify overlap with the optimization changes, notably `functions/sites/shared.ts`, and whether the original Sites optimization test fixture should be restored now that its contracts return.

## Constraints
Read-only, requiredCapabilities empty. Do not modify files, run deployment/operator scripts, query school records, or access credentials. Do not merge original branch history: it contains raw school photo assets and local operator artifacts under `deliverables/obhis-hosted-launch/`, which must remain untracked/unpushed. Do not propose publishing those artifacts. Maintained app code references approved storage assets; raw launch files are not needed in GitHub for this restoration. Keep `apps/www` and unrelated root `public` changes out. No rebasing or squashing, no GitHub merge, no Production frontend/backend deployment or infrastructure changes.

## Definition of done
- Exact restored-path manifest and exclusion list.
- Proposed conflict-safe content-backport procedure that preserves the deployed optimizations without importing private ancestor history.
- Concrete focused test/typecheck/build commands for affected backend, shared, Admin, Platform and Sites code.
- Any confirmed missing dependency or release blocker, rather than speculative cleanup.

## Expected artifacts
A returned scope report with paths and verification commands. No filesystem writes.

## Verification checkpoint
The parent approves the manifest before the single writer restores source. Independently review the resulting branch after local checks.
