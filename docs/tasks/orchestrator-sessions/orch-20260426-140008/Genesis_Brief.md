# Genesis Brief - Lesson Knowledge Hub v2

## Status
Genesis foundation completed for the context-first planning redesign.

## Core decision
Teacher planning moves from source-first to context-first:
- Topic work: `Subject -> Level/Class -> Term -> Topic`
- Exam work: `Subject -> Level/Class -> Term -> Exam scope`

## Boundaries locked
- The library remains a repository and retrieval surface.
- Topic workspaces own lesson, note, assignment, and topic-level quiz authoring.
- Exam workspaces own subject-scope exam drafting.
- Broad planning references remain reusable without forced topic binding.
- Portal-facing resources remain topic-attached and approval-gated.

## Compatibility expectations
- Existing source-first drafts must still open safely.
- Existing `sourceIds` links remain supported during transition.
- Existing broad planning references stay valid.
- Existing approved topic resources keep their current visibility behavior.

## Artifacts updated
- `docs/Project_Requirements.md`
- `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`
- `docs/issues/FR-010.md`
- `docs/issues/FR-016.md`

## Recommended next stage
Current Takomi stage: Genesis complete.

Recommended next stage: Design.

### Recommended design fan-out
1. Planning information architecture and workflow redesign
2. Domain model and retrieval contract for context-first planning
3. Migration, sequencing, and UX risk review

### Recommended build fan-out
1. Planning hub and context launcher
2. Context-aware query layer and draft identity refactor
3. Topic workspace source pane and add-material flow
4. Question bank refactor for topic-first and exam-scope flows
5. Lesson-plan workspace refactor for topic-first planning
6. Library repositioning and classification cleanup
7. Migration pass, verification, and rollout handoff
