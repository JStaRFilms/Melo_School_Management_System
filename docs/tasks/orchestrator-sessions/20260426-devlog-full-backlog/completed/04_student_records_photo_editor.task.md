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
- Provider/model: `oauth-router/gpt-5.5`.
- Reasoning effort: Medium.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: High.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Storage/auth/report-card surfaces make this complex but bounded.

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

## Completion Notes

- Updated `docs/features/StudentEnrollmentProfileCapture.md` with the photo crop/replace/remove behavior and student matrix/report-card display path.
- Audited `/academic/students`: class-first creation and profile editing already used admin-scoped Convex mutations for student fields, generated student emails, parent linking, and separate onboarding. No cross-school bypass was found in the touched flows.
- Added reusable client-side 3:4 crop processing for class-first creation and profile editing before upload to Convex storage.
- Preserved remove behavior by passing `photoStorageId: null` through `updateStudent`; replace uses the existing admin-only upload URL and `updateStudent` metadata path.
- Added `photoUrl` to the class student subject matrix and rendered photos in desktop/mobile roster records with initials fallback.
- Confirmed report cards and portal data already resolve `student.photoStorageId` to `photoUrl`; no portal UI edit was needed for this task.
- Added file-size/type validation to the standalone student onboarding photo picker to match the shared upload rules.

## Review Fix Pass

- Added reset handling for the class-first and standalone onboarding photo panels so saved/reset forms do not keep stale local crop state.
- Added profile-editor reset handling keyed to the selected student so a previous local photo cannot be applied to another student.
- Exposed crop processing state to creation/profile/onboarding forms and disabled submission while crop output is still being prepared; processing is now set synchronously on image selection and crop-slider changes.
- Reused the crop panel in standalone student-first onboarding so that both admission flows support the same crop/add/replace/remove behavior.
- Hardened Convex photo validation by checking the real `_storage` document existence, content type, and 1 MB size limit before persisting a photo reference.
- Added session school-scope validation to the class student subject matrix query.

## Verification

- `corepack pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false` — passed.
- `corepack pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false` — passed.

## Status

Completed 2026-05-08.
