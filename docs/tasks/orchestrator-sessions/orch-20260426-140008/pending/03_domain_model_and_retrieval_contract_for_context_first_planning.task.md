# Task: Domain model and retrieval contract for context-first planning
**Task ID:** 03
**Stage:** design
**Status:** pending
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-03
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260426-140008

Task title: Domain model and retrieval contract for context-first planning
## Objective
Define the data and query contracts that let topic/exam workspaces pull relevant sources, drafts, and materials automatically.
## Scope
- Specify topic-bound vs broad planning-reference vs subject-scope assessment relationships
- Define recommended queries for topic workspace source retrieval, prior drafts, and suggested materials
- Define exam-scope retrieval rules by subject, level/class, term, and optional topic subset
- Define persistence keys so drafts remain distinct across topic context and exam scope
- Define compatibility rules for existing saved assessment/question-bank drafts and lesson-plan drafts
## Checklist
- No checklist yet.
## Definition of Done
- A backend contract exists for topic context lookup, exam scope lookup, and source suggestion/loading
- Draft identity rules are explicit and refresh-safe
- Broad planning references can be reused across many topics without requiring one permanent topic binding
## Expected Artifacts
- Data contract notes
- Query/retrieval contract
- Draft identity rules
## Dependencies
- None specified.
## Review Checkpoint
Approve persistence and retrieval rules before backend refactors begin.
## Instructions
- Do not invent unnecessary new tables unless they solve a real identity or retrieval problem.
- Keep school-scoped auth and current permission boundaries intact.