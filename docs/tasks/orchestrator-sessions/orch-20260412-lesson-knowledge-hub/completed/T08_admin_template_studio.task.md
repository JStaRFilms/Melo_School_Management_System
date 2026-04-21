# T08 Admin Template Studio

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Inspect `apps/admin/app/assessments/setup/report-card-bundles/`
- Use `takomi`, `frontend-design`, and `convex-functions`

## Objective

Build the lesson-template studio at `/academic/knowledge/templates` using the repo’s existing bundle-editor precedent.

## Scope

Included:

- template list
- section/rule editor
- objective minimums
- output type selection
- applicability by subject and level
- preview or monitor view

Excluded:

- teacher lesson-plan generation UI
- question-bank editing

## Definition of Done

- Admin can create and edit template records for `lesson_plan`, `student_note`, and `assignment`.
- Applicability metadata supports the specificity order defined in the blueprint.
- Validation prevents invalid or incomplete template definitions.

## Expected Artifacts

- admin route and components
- Convex template queries and mutations
- validation helpers

## Constraints

- Reuse the report-card bundle editing design language where practical.
- Keep the template engine structured rather than free-form.

## Verification

- Template resolution metadata saves correctly.
- Validation catches duplicate sections, missing rules, and invalid applicability combinations.
