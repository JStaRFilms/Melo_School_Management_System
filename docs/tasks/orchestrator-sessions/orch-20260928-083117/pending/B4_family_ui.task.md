# Task B4: Render withheld and released family graded results correctly

## Agent setup

### Workflow to follow
Takomi Vibe Build: frontend implementation with focused UI regression tests.

### Prime agent context
Read `AGENTS.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{master_plan.md,spec.md,design.md,results/B2.md}`, `packages/convex/functions/portal.ts` response validator, `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`, portal types/report card components and existing tests. Read the FR-023 portal handoff read-only for shared typed result model.

### Optional skill/context overlays
Frontend conventions, unslop, school theme tokens. For school-facing changes run the informational theme audit.

## Objective
Remove family UI fallbacks that show an older published report as the current withheld term; show explicit selectedResultState and only released history across dashboard/results/report cards/notifications/print.

## Scope
- Replace any `activeHistoryItem` fallback to first result for selected-term summaries. Use selected issued card only for current report. Keep released older history independently navigable; history rows link only exact released tuple.
- Withheld, no-eligible, loading and error states per design.md. Hide report/print/download controls and subject/average/comment/pending UI when selectedResultState is withheld. Prevent stale previous child/term query content during navigation; ensure typed query args equal current URL selection before showing sensitive data or print controls.
- Distinct neutral messages; notifications only use released data from B2. Do not weaken backend gate or add narrative fallback. FR-023 owns narrative mode rendering in parallel worktree.
- Focused portal UI tests for dashboard, results, report-cards/history and print, desktop/mobile as practical, including withheld current term + published older history and child switch.
- Portal typecheck, targeted lint/tests, `node scripts/audit-theme-colors.mjs`; classify direct colours.

## Definition of done
No family UI presents a selected withheld term's score or previous term as current. Print/render routes show only matching selected released snapshot. Released history is navigable. Accessibility and theme rules honored. Tests/typecheck results recorded.

## Expected artifacts
Portal UI/components/types/tests plus `docs/tasks/orchestrator-sessions/orch-20260928-083117/results/B4.md`.

## Constraints
Do not edit Convex backend, original checkout or FR-023 worktree. Never fake a narrative result; if typed integration needed, write note for PR reconciliation. No commit/push/deploy or unrelated redesign.

## Dependencies
B2 portal API, D1 design; B3 Admin controls complete. Integrated review to follow.

## Verification/review checkpoint
Orchestrator checks privacy of dashboard and direct routes, stale navigation and print then runs portal tests and theme audit.
