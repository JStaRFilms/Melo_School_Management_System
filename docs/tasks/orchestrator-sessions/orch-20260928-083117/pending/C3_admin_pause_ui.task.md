# Task C3: Surface server release pause and stable readiness actions

## Agent setup
Follow Takomi Vibe Build corrective UI pass. Read `AGENTS.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{spec.md,design.md,results/C1.md,results/review-round-1.md}`, `resultPublication.ts`, `ClassReleasePanel.tsx`, release page and Admin UI tests. Read Convex guidelines if editing backend. No FR-023 edits.

## Objective
Connect the Admin release screen to C1's server-side pause and stable readiness codes/allowed actions, without making a pause look like revocation.

## Scope
- `getReleaseContext.releasesPaused` disables all new release confirmations and shows a school-scoped notice. Authorized school admin can pause/resume with required reason and explicit confirmation, calling C1's `setReleasesPaused`; show current reason/updatedAt and safe failure. Exam officer cannot toggle. Backend permission remains authoritative.
- Use readiness row `canExclude`/`reasonCode` rather than parsing human error prose to decide admin exclusion action. Keep displayed reason text for users. Preserve tuple/role reset and original released status while paused.
- Add/update Admin UI tests for pause/resume, exam officer blocked toggles, reason code controls and released visibility unchanged. Run Admin/Convex typecheck, targeted lint, tests and theme audit.

## Definition of done
Direct backend pause and UI agree: no new release while paused, existing published reports remain visible, authorized admin can resume, exam officer sees status but cannot toggle. No reason-text authorization logic. Verification recorded.

## Expected artifacts
Admin release components/tests and `docs/tasks/orchestrator-sessions/orch-20260928-083117/results/C3.md`.

## Constraints
Only isolated result-publication worktree. No `portal.ts`, FR-023 worktree, commit/push/merge/deploy. Keep status colours semantic and school palette constraints.

## Dependencies
B3 UI and C1 backend. C2 portal fix complete.

## Verification/review checkpoint
Orchestrator validates pause error state and Admin UI tests before final review.
