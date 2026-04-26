# T16 Assessment Generation Profiles And Question Mix — Result

## Status

Completed

## Summary

This task added school-scoped assessment-generation profiles so admins can define reusable question-style defaults and teachers can apply or override the effective mix during assessment drafting.

The work stayed locked to authoring-time generation controls only.

Delivered in this task:

- admin-managed assessment generation profiles
- teacher-side profile selection in the question-bank workspace
- bounded teacher overrides for question style and per-type counts
- persistence of effective generation settings with saved drafts
- persistence of generation settings in AI run logs
- generation prompt/path updates so output follows the configured mix
- support for open-ended-heavy and mixed-open-ended authoring without expanding into student delivery

## Key Changes

### Convex persistence and schema

- `packages/convex/schema.ts`
  - added `assessmentGenerationProfiles`
  - added `effectiveGenerationSettings` to:
    - `assessmentBanks`
    - `aiRunLogs`

- `packages/convex/functions/academic/lessonKnowledgeAssessmentProfiles.ts`
  - added admin profile listing/saving support
  - profile settings include:
    - `questionStyle`
    - `totalQuestions`
    - `questionMix`
    - `allowTeacherOverrides`
    - `isDefault`
    - `isActive`

- `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
  - workspace now returns active profiles for teacher assessment drafting
  - saved assessment banks now persist `effectiveGenerationSettings`
  - AI run logs now persist `effectiveGenerationSettings`
  - final validation enforces:
    - normalized question-mix counts
    - at least one generated question
    - inactive profile rejection
    - locked profile / locked default protection against direct API bypass

### Admin surface

- `apps/admin/app/academic/knowledge/assessment-profiles/page.tsx`
  - added a dedicated admin route for assessment-generation profiles
  - admins can:
    - create profiles
    - edit profiles
    - mark a profile as school default
    - activate/deactivate profiles
    - control whether teachers may override the selected profile

- `packages/shared/src/workspace-navigation.ts`
  - added admin navigation entry:
    - `/academic/knowledge/assessment-profiles`

### Teacher assessment workspace

- `apps/teacher/app/planning/question-bank/types.ts`
  - added types for:
    - `AssessmentQuestionStyle`
    - `AssessmentQuestionMix`
    - `AssessmentGenerationSettings`
    - `AssessmentGenerationProfile`

- `apps/teacher/app/planning/question-bank/components/QuestionBankWorkspaceScreen.tsx`
  - added generation-profile controls:
    - profile selector
    - question-style selector
    - per-question-type count controls
    - total-question summary
  - save/generate signatures now include the edited effective generation settings

- `apps/teacher/app/planning/question-bank/page.tsx`
  - now forwards teacher-edited generation settings into both save and generate flows

### Generation route behavior

- `apps/teacher/app/api/ai/question-bank/generate/route.ts`
  - accepts `effectiveGenerationSettings`
  - incorporates settings into prompt constraints
  - maps generated questions onto the configured question-type plan
  - enforces generated-question count equals the configured total before save
  - writes generation settings into AI run logs and saved draft payloads
  - rejects locked-profile override attempts and inactive profile usage server-side

### Generated artifacts/codegen

- `packages/convex/_generated/api.d.ts`
  - updated for the new assessment profile functions

## Reviewer / Fix Notes

This task was not accepted on the first pass.

Follow-up fixes were applied after review:

- fixed a wiring bug where the teacher page was still using stale `workspace.draft.effectiveGenerationSettings` instead of the settings edited in the workspace UI
- added admin nav discoverability for the new assessment profile route
- enforced generated question count to match the configured total
- closed a server-side policy hole where locked profiles could be bypassed by omitting `profileId`
- rejected inactive profiles in teacher generation/save validation
- prevented locked school-default profile bypass when no profile ID is supplied

## Verification

Ran successfully:

- `pnpm -C packages/convex typecheck --noEmit`
- `pnpm -C apps/teacher typecheck --noEmit`
- `pnpm -C apps/admin typecheck --noEmit`
- `pnpm -C packages/shared typecheck`
- `git diff --check`

## Scope Notes

Explicitly not added here:

- student test-taking UI
- exam delivery runtime
- automatic scoring
- moderation runtime
- analytics/reporting

## Next Task

- `T15` remains the final verification, docs sync, reconciliation, and handoff task.
