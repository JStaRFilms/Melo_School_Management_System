# Task: Implement RAG source excerpt retrieval for teacher instruction generation
**Task ID:** B02
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-B02
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.4
## Context
Parent session: orch-20260428-192258

Task title: Implement RAG source excerpt retrieval for teacher instruction generation
## Objective
Feed relevant parsed source content excerpts into lesson-plan/student-note/assignment prompts using existing stored material text where possible.
## Scope
- packages/convex/functions/academic/lessonKnowledgeLessonPlans.ts
- apps/teacher/app/api/planning/lesson-plans/generate/route.ts
- packages/ai/src/prompts.ts
- types/docs if needed
## Checklist
- [x] Generation prompt includes bounded relevant source excerpts, not only metadata
- [x] Generation fails clearly when selected sources have no usable extracted content
- [x] School/access boundaries remain enforced
- [x] Typecheck/lint pass
## Definition of Done
- Generation prompt includes bounded relevant source excerpts, not only metadata
- Generation fails clearly when selected sources have no usable extracted content
- School/access boundaries remain enforced
- Typecheck/lint pass
## Expected Artifacts
- None specified.
## Dependencies
- B01
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Use minimal RAG first: keyword/topic matching and bounded excerpts from accessible selected sources; do not build embeddings unless already available.
- Keep source excerpt char/token limits sane.
- Preserve template-bound generation and repair loop.
## Notes
Implemented getTeacherInstructionSourceExcerpts query using knowledgeMaterialChunks and existing access gates; generation route fetches excerpts, blocks zero-excerpt generation, passes excerpts into prompts; prompt contract renders bounded excerpts with grounding instructions.