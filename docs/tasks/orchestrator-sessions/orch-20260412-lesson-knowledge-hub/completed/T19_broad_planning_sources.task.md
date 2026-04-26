# T19 Broad Planning Sources

**Mode:** `vibe-build`
**Workflow:** `/vibe-continueBuild`

## Objective

Support broad planning sources like curriculum PDFs without forcing a topic attachment, while still allowing teachers to generate topic-specific lesson plans and assessment drafts from those broader references.

## Scope

Included:

- planning-library support for curriculum / cross-topic planning references
- reuse of existing `imported_curriculum` semantics where possible
- lesson-plan generation support for teacher-provided target topic when sources are broad
- question-bank generation support for teacher-provided target topic when sources are broad
- keeping broad planning references planning-only by default

Excluded:

- new tables or major schema redesign
- portal exposure changes for curriculum references
- full curriculum-to-topic import automation
- admin-side term/topic auto-breakdown from curriculum PDFs

## Definition of Done

- Teachers can upload a curriculum/planning reference without being pushed into a real topic attachment.
- Broad planning sources do not incorrectly become the resolved topic context in generation workspaces.
- Lesson-plan and question-bank generation can proceed with a teacher-entered target topic when the source set is broad.
- Verification passes with no lint/typecheck/build errors.
