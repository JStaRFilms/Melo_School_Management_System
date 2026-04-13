# T10 Teacher Editor And Generation

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review the outputs of `T04`, `T05`, `T06`, and `T08`
- Use `takomi`, `ai-sdk`, `frontend-design`, and `convex-functions`

## Objective

Build the teacher lesson-plan workspace at `/planning/lesson-plans` and its generation route handlers.

## Scope

Included:

- rich-text-lite editor
- autosave
- source sidebar
- template-aware generation
- revision snapshots
- derived student-note and assignment generation
- teacher API route handlers for streaming generation

Excluded:

- multiplayer collaboration
- student delivery engine

## Definition of Done

- Teacher can open a lesson-plan draft tied to class, subject, and selected sources.
- AI generation uses the resolved template and selected materials only.
- Teacher can edit the output and keep revision history.
- Teacher can derive student notes and assignments from the same artifact.

## Expected Artifacts

- teacher route and components
- generation route handlers
- Convex artifact persistence
- autosave/revision support

## Constraints

- Keep the editor single-user.
- Preserve editable output at every stage.
- Failure states must never destroy the draft.

## Verification

- Lesson-plan generation, autosave, and derived-output generation complete successfully.
- Selected source IDs are persisted and auditable.
