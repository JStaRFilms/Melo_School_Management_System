# T07 Parent and Family Linking Foundation

## Status

Completed on `2026-04-12`.

## What Changed

1. Added a school-scoped family model in `packages/convex/schema.ts`:
   - `families`
   - `familyMembers`
   - optional `familyId` on `students`
   - optional `phone` on `users` for parent contact data
2. Extended `packages/convex/functions/academic/studentEnrollment.ts` with family-linking primitives:
   - `getStudentFamilyProfile`
   - `upsertStudentFamilyLink`
   - `removeStudentFamilyLink`
   - preserved `familyId` during student updates so the new field is not lost on replace-based saves
3. Added an admin-facing family panel at `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx`.
4. Wired the family panel into `apps/admin/app/academic/students/components/StudentProfileEditor.tsx` so admins can manage parent links from the existing student profile workflow.
5. Synced the rollout docs and FR tracking:
   - `docs/features/AdminAcademicSetupEnrollment.md`
   - `docs/features/ParentFamilyLinkingFoundation.md`
   - `docs/issues/FR-005.md`

## Files Updated

- `packages/convex/schema.ts`
- `packages/convex/functions/academic/studentEnrollment.ts`
- `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx`
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
- `docs/features/AdminAcademicSetupEnrollment.md`
- `docs/features/ParentFamilyLinkingFoundation.md`
- `docs/issues/FR-005.md`

## Verification Run

- `pnpm --filter @school/convex exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm --filter @school/admin exec tsc --noEmit -p tsconfig.json` ✅
- `pnpm exec tsc --noEmit` ⚠️ fails on pre-existing repo-wide alias/type issues outside this slice

## Notes

- The new family model is intentionally school-scoped and lightweight so billing and portal work can attach later without reshaping the student roster flow.
- Parent identities are now captured through the student profile workflow, but the parent portal itself remains out of scope.
- The root `tsc --noEmit` command still reports pre-existing monorepo issues unrelated to this change; package-level typechecks for the edited convex and admin packages are clean.
