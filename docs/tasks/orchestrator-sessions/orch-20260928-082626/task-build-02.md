# Task B2: add normal staff entry and admin publishing for subject comments

## Agent setup

Role: coder, vibe-build. Work only in `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress`. Read `AGENTS.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/FR-023.md`, `docs/tasks/orchestrator-sessions/orch-20260928-082626/{master_plan.md,ux_design.md,backend-handoff.md,portal-agent-handoff.md}`, relevant FR-004/005/006/008/010. Read Convex guidelines before backend edits. FR-023 overrides the earlier single-comment/template/card design descriptions. Existing graded behavior is the default and must remain unchanged.

## Objective

Make subject comments feel like existing score entry. School admin picks classes for a session and selects "Comments" or "Scores and grades". Teacher chooses their usual session/term/class/subject, sees enrolled students and writes a different comment for each student for that subject. Admin reviews the student's collection of subject comments and publishes their report. Schools create/assign subjects through their existing Academic Structure/subject setup; do not hardcode preschool labels, require a template, or mutate class subject assignments just by toggling mode.

## Scope

- Inspect current teacher `apps/teacher/app/assessments/exams/entry/page.tsx` and workspace selectors, admin `apps/admin/app/assessments/results/entry/page.tsx`, admin `apps/admin/app/assessments/report-cards/page.tsx` and existing `apps/admin/app/assessments/setup/*`/subject-management screens. Add simple admin reporting-mode selection in assessment setup with session selector and class checkboxes. Use B1 `listClassModes`/`setClassModes` and show current choices/locked state. Add a link to existing subject/class assignment setup, not a second subject system. No named class sets or required template editor.
- Add a bounded backend subject-comment entry-sheet query if needed, reusing existing roster/session enrollment and teacher subject assignment checks rather than N queries for the entire class. Protect all writes with B1's `saveDraft`. Use the normal teacher and admin selectors in subject entry pages: branch by `getClassMode` before calling graded `getExamEntrySheet`; keep the graded path untouched. For comment mode show each student and their free-text draft for the selected subject, save feedback, pending/issued state and clear errors. One comment per student per subject/term. Do not show score cells or allow score saves for narrative mode. Support keyboard, mobile, accessible labels and empty subjects/rosters.
- Admin report-card review route: use `getStaffPreview`/`publish`; show all subject comments in a clean per-student review, list missing comments, explicit one-student publish and stale-review recovery; issued copy read-only. Preserve graded certification route. Teacher report-card workbench/preview must not query the graded card for narrative mode (it requires subjects and scores); link to subject comments entry or show a clear read-only summary of only authorized content. Staff draft state must say not visible to families.
- Targeted UI and backend tests for mode selection, teacher comments per subject per student, teacher subject restriction, graded routing unchanged, admin publish and empty/locked/error states. Run package typechecks/focused tests, lint if feasible, `node scripts/audit-theme-colors.mjs` for touched school-facing files; classify direct colors by category. Do not modify `packages/convex/functions/portal.ts` or parent portal, which are B3/other-agent integration. No blanket global replacements.

## Definition of done

Admin can configure classes per session and sees whether each choice is locked. School can use current subject assignment. A teacher actually enters a comment per student for the chosen subject in the normal entry area and cannot see score entry for a comment-mode class. Admin can review all comments and publish, or see why publication is blocked. Existing graded entry and reports remain usable. Server and UI tests pass or exact blockers are recorded.

## Expected artifacts

Modified `apps/admin/app/assessments/**` and `apps/teacher/app/assessments/**`, focused components/tests; optionally bounded Convex staff entry-sheet query and test; `docs/tasks/orchestrator-sessions/orch-20260928-082626/staff-handoff.md` with routes, tests and parent/UI integration notes.

## Dependencies and review checkpoint

Depends on B1 and `backend-handoff.md`. Orchestrator reviews real entry flow with two students/two subjects, no graded regressions, auth and server guards before assigning B3. The independent review checks the complete diff later.
