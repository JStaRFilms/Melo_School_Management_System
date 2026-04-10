# T01 Shipped Core Hardening

## Status

Completed on `2026-04-09`.

## What Changed

1. Fixed stale Convex auth test expectations so `getAuthenticatedSchoolMembership` assertions now match the current return shape, including `isSchoolAdmin`.
2. Fixed stale shared-domain editing-policy tests so they match the current finalized-vs-window-closed behavior and still cover the non-finalized closed-window path.
3. Fixed stale admin UI tests so they match the current grading-band and exam-mode copy/components instead of older mockup text and CSS classes.
4. Replaced the root `pnpm test:e2e` build-only gate with real Playwright browser smoke coverage for the shipped admin and teacher academic flows.
5. Updated verification documentation to reflect the real shipped-core baseline and the new E2E behavior.
6. Updated the orchestration session summary/master plan to mark `T01` complete and record the remaining blocker accurately.

## Files Updated

- `packages/convex/functions/academic/__tests__/auth.test.ts`
- `packages/shared/src/exam-recording/__tests__/editing-policy.test.ts`
- `apps/admin/__tests__/BandTable.test.tsx`
- `apps/admin/__tests__/ExamModeSelector.test.tsx`
- `package.json`
- `.gitignore`
- `playwright.config.js`
- `e2e/global-setup.js`
- `e2e/academic-smoke.spec.js`
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
- `pnpm test:e2e` ✅ with real Playwright browser smoke coverage

## Current Limitation

`pnpm test:e2e` now runs real browser coverage, but it is still only a smoke baseline. The current suite focuses on shipped academic admin/teacher flows and does not yet cover broader school setup, results moderation, or billing paths.

## Remaining Follow-Up

- Expand Playwright coverage beyond the shipped academic smoke flows.
- Clean up the existing teacher-app React Hooks warning and the recurring Next.js ESLint-plugin notice in platform when the team enters the dedicated verification lane.
