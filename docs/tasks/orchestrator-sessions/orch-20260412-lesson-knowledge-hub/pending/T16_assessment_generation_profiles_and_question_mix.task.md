# T16 Assessment Generation Profiles And Question Mix

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review the outputs of `T08` and `T11`
- Use `takomi`, `ai-sdk`, `frontend-design`, and `convex-functions`

## Objective

Add reusable assessment-generation profiles so admins can define question-style defaults and teachers can override the effective mix for a specific draft/classroom context.

## Scope

Included:

- admin-managed assessment-generation profile settings
- support for controlling counts by question type
- open-ended-first / mixed-open-ended authoring support
- teacher-side override controls at generation time
- persistence of the effective generation settings with the draft and AI run metadata

Excluded:

- student test-taking UI
- automatic scoring
- analytics and reporting
- broad exam-delivery runtime changes

## Definition of Done

- Admins can save reusable assessment-generation settings templates for the school.
- Teachers can choose a profile and override the question mix for the current draft.
- Generation respects the configured counts and question-style direction.
- Open-ended authoring can be favored without forcing pure objective / CBT output.

## Expected Artifacts

- admin settings/template surface or extension
- teacher question-mix controls in the assessment workspace
- Convex persistence for assessment-generation profiles and effective overrides
- AI prompt/path updates so generation follows the configured mix

## Constraints

- Keep this task scoped to authoring-time generation controls only.
- Do not expand into student delivery, scoring, or moderation runtime work.
- Preserve editable output after generation.
- Keep teacher overrides bounded so school-level defaults still provide a sane baseline.

## Verification

- Teachers can generate an open-ended-heavy draft by selecting a profile or overriding the mix.
- Saved drafts reload with the expected effective settings.
- AI run logs preserve the generation profile / override context used for the draft.
