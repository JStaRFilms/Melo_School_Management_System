# T09 Teacher Library And Publish Flow

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Inspect teacher workspace navigation and selector-driven pages
- Use `takomi`, `frontend-design`, and `convex-functions`

## Objective

Build the teacher library surface at `/planning/library`.

## Scope

Included:

- teacher uploads
- private-first material management
- label editing
- search and filter UI
- explicit publish-to-staff action
- source selection handoff to the lesson-plan workspace

Excluded:

- lesson-plan editor
- question-bank editor

## Definition of Done

- Teacher uploads default to `private_owner`.
- Teacher can edit labels before publishing.
- Teacher can search both private and staff-visible material according to permissions.
- Teacher can pass selected sources into the lesson-plan route cleanly.

## Expected Artifacts

- teacher route and components
- upload helpers
- publish actions
- source-selection state handoff

## Constraints

- Keep the workflow fast on mobile.
- Do not auto-publish teacher uploads.

## Verification

- A private upload can be relabeled and promoted to `staff_shared`.
- Teachers cannot access content outside their school scope.
