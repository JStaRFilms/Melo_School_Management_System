# Task B3: Add Admin class-result release controls

## Agent setup

### Workflow to follow
Takomi Vibe Build; frontend implementation and focused tests only.

### Prime agent context
Read `AGENTS.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{master_plan.md,spec.md,design.md,results/B1.md,results/B2.md}`, `packages/convex/functions/academic/resultPublication.ts`, `apps/admin/app/assessments/report-cards/page.tsx`, `apps/admin/app/assessments/report-cards/components/CertifyReportCard.tsx`, Admin assessment navigation/selection components and existing tests. Read Convex guidelines before touching Convex API.

### Optional skill/context overlays
Frontend UI conventions, unslop, school theme rules and status/grade semantics.

## Objective
Give authorized staff an Admin release workflow matching design.md: class/session/term readiness, reasoned school-admin-only exclusions, explicit exam-officer release with fresh review key and clear certification-vs-publication copy.

## Scope
- Add an Admin route or existing report-card panel entry for class release. Use existing selectors/navigation where practical. Show complete counts/status/blockers and non-score roster. Handle bounds/error states without implying readiness. Responsive/accessible controls.
- Display role/permission effects server-side and UI-side: users with publish-final can release, only school admins may exclude with reason; denied actions remain denied by backend. No teacher release screen.
- Reset stale selected tuple state and confirmation on class/session/term change. Required confirmation string must exactly match B1 mutation; show stale reviewedKey error and requery. Show immutable original release metadata on retry.
- Link missing student to existing report-card review with tuple context. Update CertifyReportCard text: certification alone never publishes, old certified copy remains for staff.
- Focused UI tests for withheld/certified counts, blocked ready status, admin exclusion/release permission, stale token/selector change and button accessibility. Keep tests cost proportionate.
- Run relevant admin typecheck, UI tests, targeted lint and `node scripts/audit-theme-colors.mjs`; classify direct colours rather than global replacement.

## Definition of done
Authorized school admins/exam officers can understand and initiate explicitly reviewed release and see original released state; no client claims certification equals publication; server remains authority. Normal users cannot see controls they lack; backend permission checks still enforced. Focused UI tests and theme audit recorded.

## Expected artifacts
Admin route/components/tests plus `docs/tasks/orchestrator-sessions/orch-20260928-083117/results/B3.md`.

## Constraints
Work only in isolated result-publication worktree. Do not change `portal.ts` or FR-023 worktree; no commit/push/deploy. Do not change status/grade colours to tenant palette. Avoid unrelated redesign. No uncontrolled bulk release or historical policy regrading.

## Dependencies
B1 API and D1 design complete; B2 portal gate complete. B4 will handle family UI separately.

## Verification/review checkpoint
Orchestrator reviews UX against design.md and server API, audits theme colors, runs relevant admin tests before B4.
