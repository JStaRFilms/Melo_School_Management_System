# Task FU4: Resolve Existing Parent and Family Conversion

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Takomi Build (`vibe-build`), direct integration-owner implementation.

### Prime Agent Context
- `packages/convex/_generated/ai/guidelines.md`
- `packages/convex/functions/admissions/conversions.ts`
- `apps/admin/app/admissions/page.tsx`
- `packages/convex/admissionsDomain.test.ts`
- `docs/features/AdmissionsExperienceDesign.md`

### Optional Skill / Context Overlays
None required. Follow the existing Convex and admissions patterns.

## Objective
Allow staff to explicitly reuse the guardian's existing parent account and family when converting a subsequently accepted child, while creating only the new student/enrollment records.

## Scope
- Add a scoped conversion-candidate query for the accepted application.
- Return only valid existing parent/family choices tied to the guardian identity and school.
- Update Admin conversion UI to select create/existing parent and family modes deliberately.
- Preserve create-only first-child conversion and existing-student resolution contracts.
- Keep conversion transactional, idempotent, tenant-scoped, and fail-closed.

## Context
The live Goodness123 application belongs to a guardian whose earlier child conversion created a parent account and `dina Family`. The UI always submits create/create/create, while the backend correctly rejects duplicate identity creation with `CONVERSION_RESOLUTION_REQUIRED`.

## Definition Of Done
- First-child conversion can create a parent, family, and student.
- Sibling conversion can reuse the exact existing parent and family and create one new student.
- Invalid cross-school or unrelated identity IDs remain rejected server-side.
- Replays do not duplicate canonical records.
- Focused tests and typechecks pass.

## Expected Artifacts
- Convex candidate query and conversion tests.
- Admin conversion-resolution UI and focused UI/model tests where appropriate.
- Updated integration report.

## Constraints
- Do not merge to `main`.
- Do not auto-merge identities or families.
- Do not delete prior failed-attempt evidence or audit history.
- Use development Convex only.

## Verification
Run focused Convex admissions tests, Admin admissions tests, affected typechecks, targeted ESLint, and `git diff --check`. Browser confirmation remains user-owned.

## Result
Completed on the integration branch. Explicit same-school parent/family candidates, UI selection, resolver relationship validation, and sibling conversion coverage are implemented. Combined verification is recorded in `follow-up/FU4_B7_B8_B9_remaining_admissions_result.md`.
