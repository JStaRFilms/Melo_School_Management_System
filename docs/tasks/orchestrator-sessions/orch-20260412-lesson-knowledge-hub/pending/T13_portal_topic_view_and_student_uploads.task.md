# T13 Portal Topic View And Student Uploads

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Inspect current portal workspace patterns
- Use `takomi`, `frontend-design`, `convex-functions`, and `convex-file-storage`

## Objective

Build the first student-facing learning surface at `/learning/topics/[topicId]` and add class-scoped student supplemental uploads.

## Scope

Included:

- portal topic page
- approved resource rendering
- class-scoped student uploads
- teacher promotion flow for student content

Excluded:

- full portal-wide learning search
- adaptive personalization

## Definition of Done

- Topic pages show only approved, class-eligible materials.
- Students can upload supplemental material scoped to their class context.
- Teachers can promote student uploads according to the v1 rules.

## Expected Artifacts

- portal route and components
- student upload flow
- promotion actions

## Constraints

- Do not expose private-owner or staff-only content to the portal.
- Keep student uploads scoped until an explicit promotion action occurs.

## Verification

- Portal filtering respects class scope and approval state.
- Promoted student content appears correctly on the topic page.
