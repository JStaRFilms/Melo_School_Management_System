# T04 Packages AI Foundation

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Read `docs/tasks/orchestrator-sessions/orch-20260412-lesson-knowledge-hub/master_plan.md`
- Use `takomi`, `ai-sdk`, and `avoid-feature-creep`

## Objective

Introduce a shared `packages/ai` workspace package for Vercel AI SDK and OpenRouter integration so teacher-side AI generation can reuse one model/prompt layer.

## Scope

Included:

- package creation
- dependency wiring
- provider setup
- model registry
- structured output schemas
- prompt builder skeletons
- retry and failure normalization helpers

Excluded:

- full teacher UI implementation
- portal or admin UI work

## Definition of Done

- `packages/ai` exists and is usable from app route handlers.
- Provider setup is shared rather than duplicated in apps.
- Lesson-plan, student-note, assignment, and question-bank generation contracts are typed.

## Expected Artifacts

- `packages/ai`
- package README or inline usage note if needed
- verification note for install/type wiring

## Constraints

- Use OpenRouter through the AI SDK integration path.
- Keep provider/model configuration centralized.
- Do not introduce chat-first abstractions; this session is document-generation oriented.

## Verification

- Package resolves from the workspace.
- Typecheck covers the new shared contracts.
