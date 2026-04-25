# T18 Teacher Topic Governance And Creation

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review `T09`, `T12`, and the final `T13` follow-up fixes
- Use `takomi`, `frontend-design`, and `convex-functions`

## Objective

Reduce admin bottlenecks by letting teachers participate in topic creation and topic attachment within bounded school rules, while preserving the existing portal approval model.

## Scope

Included:

- teacher-side topic creation or proposal flow for assigned subject/class scope
- teacher-side topic attachment support for eligible planning materials
- policy-aware governance direction that can support admin-controlled schools without blocking classroom operations
- clear UI distinction between free-text topic labels and real topic attachments
- persistence/audit updates needed for teacher-driven topic actions

Excluded:

- full curriculum planner redesign
- unrestricted cross-school or cross-subject topic editing
- broad approval-policy settings framework if not required for the first working pass
- unrelated portal redesign

## Definition of Done

- Teachers can create or propose a real topic within their allowed scope without requiring admin intervention for every routine case.
- Teacher UI clearly distinguishes topic label text from attached real topics.
- Topic-attached teacher materials can move through the existing approval model correctly.
- The workflow remains bounded to teacher-assigned subject/level/class context.

## Expected Artifacts

- teacher-side topic creation/attachment UI
- Convex support for teacher-scoped topic creation or proposal handling
- audit trail updates for teacher topic actions
- docs note explaining the governance model actually shipped

## Constraints

- Keep scope aligned with the existing Lesson Knowledge Hub v1 blueprint.
- Do not turn this into a full curriculum-management subsystem.
- Preserve admin override ability and portal safety rules.
- Avoid forcing admin involvement for every topic if the teacher is within their valid scope.

## Verification

- A teacher can create or propose a valid topic from the planning surface.
- Teacher-created topics stay within assigned scope.
- Attached teacher materials can still be approved for portal exposure through the existing visibility/review flow.
- The UI no longer misleads users into thinking a free-text label alone creates a portal topic.
