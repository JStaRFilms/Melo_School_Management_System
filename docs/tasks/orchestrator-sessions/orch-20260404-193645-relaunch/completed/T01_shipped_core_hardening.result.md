# T01 Shipped Core Hardening

## Status

Completed on `2026-04-09`.

## What Changed

1. Fixed stale Convex auth test expectations so `getAuthenticatedSchoolMembership` assertions now match the current return shape, including `isSchoolAdmin`.
2. Fixed stale shared-domain editing-policy tests so they match the current finalized-vs-window-closed behavior and still cover the non-finalized closed-window path.
3. Fixed stale admin UI tests so they match the current grading-band and exam-mode copy/components instead of older mockup text and CSS classes.
4. Updated verification documentation to reflect the real shipped-core baseline and the current `test:e2e` limitation.
5. Updated the orchestration session summary/master plan to mark `T01` complete and record the remaining blocker accurately.

## Files Updated

- `packages/convex/functions/academic/__tests__/auth.test.ts`
- `packages/shared/src/exam-recording/__tests__/editing-policy.test.ts`
- `apps/admin/__tests__/BandTable.test.tsx`
- `apps/admin/__tests__/ExamModeSelector.test.tsx`
- `docs/issues/FR-018.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`

## Verification Run

- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/shared exec tsc --noEmit` ✅
- `pnpm --filter @school/admin exec tsc --noEmit` ✅
- `pnpm --filter @school/convex test` ✅
- `pnpm --filter @school/shared test` ✅
- `pnpm --filter @school/admin test` ✅
- `pnpm typecheck` ✅
- `pnpm lint` ✅ passes with existing non-blocking warnings/notices
- `pnpm test` ✅
- `pnpm test:e2e` ✅ as a build-only gate

## Current Limitation

`pnpm test:e2e` is not real E2E coverage yet. In `turbo.json`, the `test:e2e` task only depends on `build`, and no workspace package currently defines a `test:e2e` script. That means the command validates production builds, not browser flows.

## Remaining Follow-Up

- Add real browser E2E coverage for critical flows before release hardening is considered complete.
- Clean up the existing teacher-app React Hooks warning and the recurring Next.js ESLint-plugin notice in platform when the team enters the dedicated verification lane.
