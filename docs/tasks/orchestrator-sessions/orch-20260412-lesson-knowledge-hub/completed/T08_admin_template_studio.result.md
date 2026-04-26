# T08 Admin Template Studio Result

## Outcome

`T08` is complete. The admin template studio now exists at `/academic/knowledge/templates` and supports structured template authoring for `lesson_plan`, `student_note`, and `assignment` templates with school-admin-only Convex persistence.

## What Changed

- added a new admin route and editor workspace:
  - `apps/admin/app/academic/knowledge/templates/page.tsx`
  - `apps/admin/app/academic/knowledge/templates/components/InstructionTemplateStudioScreen.tsx`
  - `apps/admin/app/academic/knowledge/templates/types.ts`
  - `apps/admin/app/academic/knowledge/templates/utils.ts`
- added admin workspace navigation for the new template studio route:
  - `packages/shared/src/workspace-navigation.ts`
- added Convex template query/mutation support with strict validators and school-admin auth:
  - `packages/convex/functions/academic/lessonKnowledgeTemplates.ts`
  - `packages/convex/functions/academic/lessonKnowledgeTemplatesHelpers.ts`
- used the existing report-card-bundles editor language as the UI precedent, but kept the template editor focused on structured rules instead of free-form text
- preserved the existing schema shape for `instructionTemplates` and saved deterministic applicability metadata for later resolution
- moved the T08 task artifact into the session `completed/` folder

## Template Studio Capabilities

- list and search template records by output type
- create and edit `lesson_plan`, `student_note`, and `assignment` templates
- configure applicability by subject + level, subject only, level only, or school default
- edit objective minimums and structured section rules
- enforce required sections and prevent duplicate section labels/IDs
- prevent conflicting active applicability combinations
- show a monitor surface that previews the fallback ladder and audit metadata
- persist audit events for template create/update actions

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck --noEmit`
- `pnpm -C packages/convex lint`
- `pnpm -C apps/admin typecheck --noEmit`

## Notes

- The repo's `apps/admin` ESLint command currently fails because its script uses an outdated `--ext` flag for the installed ESLint major version, so I verified the admin changes with TypeScript checks instead.
- Scope stayed locked to T08; teacher generation UI, question-bank editing, and review-queue work were not added.
