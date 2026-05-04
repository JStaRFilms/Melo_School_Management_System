# Task 04: Student Records and Photo Editor

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/features/StudentEnrollmentProfileCapture.md`.
- Read `docs/features/Refactor_Students_Workbench.md`.
- Read `docs/features/PortalAcademicPortalFoundation.md` if portal display is affected.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `convex-file-storage`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Coder.
- Initial model: `gpt-5.4`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Escalate if storage/auth boundaries or report-card integration become risky.

## Objective

Improve student record handling and add student profile photo editing for records and report cards.

## Scope

- Audit `/academic/students` loading of parents, children, emails, editable fields, and onboarding route behavior.
- Add upload/crop/replace for student profile photos.
- Store photo references safely using the existing storage pattern.
- Display student photos where records and report cards expect them.
- Preserve both class-first student editing and separate student onboarding flows.

## Acceptance Criteria

- Admin can add, crop, replace, and remove a student profile photo.
- Student photo appears in relevant student record/report-card surfaces.
- Parent/child linking and student email assignment regressions are fixed if found by audit.
- Student editing remains clean and scoped to the active school.
- Docs are created or updated before/with implementation.
- File sizes and component boundaries respect the 200-line rule.
