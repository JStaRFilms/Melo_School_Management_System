# T13 Topic Work Return Path

Session: `orch-20260426-140008`  
Stage: Build polish  
Date: 2026-04-26

## User problem

Teachers needed a clearer way to come back later and see the work created under a topic: sources, lesson notes/plans, and question-bank drafts. Rebuilding the context from class/term/subject/topic works for creation, but it is too repetitive as the only return path.

## UX decision

Keep the context-first creation flow, but add a return/browse layer on `/planning`:

- `Continue work`
- Search topics
- Topic cards show sources, lesson outputs, and question-bank outputs
- Cards jump directly back into lesson or question workspaces using the topic context

The library remains compacted as a source repository. Topic work becomes the teacher-facing place to resume lesson/question work.

## Implementation

### Backend

Added query:

- `packages/convex/functions/academic/lessonKnowledgeTeacher.ts`
  - `listTeacherPlanningTopicWork`

The query returns topic work cards with:

- topic id/title/summary
- subject/level/term
- preferred class for the topic level
- source count
- ready source count
- lesson artifact count
- question-bank count
- recent outputs
- latest updated timestamp

It respects teacher/admin access boundaries and only shows accessible materials/drafts.

### Frontend

Updated:

- `apps/teacher/app/planning/page.tsx`

Added a `Continue work` section above the creation launchers:

- search box
- topic work cards
- source/lesson/question counts
- recent saved outputs
- quick actions:
  - `Open lessons`
  - `Open questions`

## Verification

Passed:

```bash
pnpm --filter @school/convex typecheck
pnpm --filter @school/teacher typecheck
pnpm lint
pnpm typecheck
pnpm build
```

## Manual test checklist

1. Open `/planning`.
2. Confirm `Continue work` appears above the topic/exam launchers.
3. Create or select a topic and create/save lesson/question work.
4. Return to `/planning`.
5. Confirm the topic appears in `Continue work` with updated counts.
6. Use search to find the topic.
7. Click `Open lessons` and confirm it opens the correct topic lesson context.
8. Click `Open questions` and confirm it opens the correct topic question context.
9. Confirm `/planning/library` still behaves as the source repository, not the main work browser.
