# T01 Shipped Core Hardening

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the Takomi orchestrator-compatible continue-build workflow, then execute as a stabilization slice.

### Prime Agent Context
Read:

- `docs/Project_Requirements.md`
- `docs/features/ExamRecording.md`
- `docs/features/CumulativeTermResultsAndBackfill.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `nextjs-standards` | Verification discipline |
| `convex-best-practices` | Backend safety |
| `webapp-testing` | Regression confidence |
| `sync-docs` | Documentation updates |

## Objective

Stabilize the already shipped admin, teacher, and platform surfaces before cumulative-results work lands.

## Scope

Included:

- fix current automated test drift
- document the real verification state
- identify and fix obvious release-blocking auth/test mismatches
- inspect the current `test:e2e` gap and record the real limitation

Excluded:

- new product features
- portal, billing, or public-site implementation

## Context

Current verification state:

- `pnpm typecheck` passes
- `pnpm lint` passes with one warning
- `pnpm test` fails in `packages/convex/functions/academic/__tests__/auth.test.ts`
- `pnpm test:e2e` currently behaves as a build-only gate

## Definition of Done

- failing unit tests are either fixed or reduced to a clearly documented blocker
- any low-effort release-blocking inconsistencies are corrected
- docs reflect the actual verification state

## Expected Artifacts

- code and test fixes if appropriate
- updated feature or verification docs
- result summary file for the orchestrator session

## Constraints

- do not expand scope into new features
- keep fixes narrowly tied to shipped-core stability
