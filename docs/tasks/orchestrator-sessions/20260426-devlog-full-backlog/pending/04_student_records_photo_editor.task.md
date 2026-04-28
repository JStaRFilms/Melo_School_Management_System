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
