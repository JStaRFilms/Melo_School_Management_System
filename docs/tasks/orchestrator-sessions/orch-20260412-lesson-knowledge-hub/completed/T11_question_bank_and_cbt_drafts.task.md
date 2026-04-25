# T11 Question Bank And CBT Drafts

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review the artifact and AI contracts from `T04`, `T05`, and `T10`
- Use `takomi`, `ai-sdk`, and `convex-functions`

## Objective

Build editable question-bank and CBT-draft authoring from lesson-plan context.

## Scope

Included:

- question-bank metadata
- item-by-item question rows
- AI-assisted draft generation
- teacher editing for answers, explanations, difficulty, and tags
- support for `practice_quiz`, `class_test`, and `exam_draft`

Excluded:

- student test-taking UI
- exam delivery runtime

## Definition of Done

- Teachers can generate a draft question bank from a lesson artifact.
- Every generated question remains editable before use.
- Banks persist item-by-item instead of as one opaque blob.

## Expected Artifacts

- teacher route and editor
- question-bank Convex modules
- AI generation path for question items

## Constraints

- Keep this task focused on authoring and draft persistence only.
- Do not bleed into the existing assessment score-entry flows.

## Verification

- Draft question sets save and reload correctly.
- Teachers can edit generated items without losing structure.
