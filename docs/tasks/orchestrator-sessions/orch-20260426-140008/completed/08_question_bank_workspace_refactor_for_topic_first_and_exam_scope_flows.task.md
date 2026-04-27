# Task: Question bank workspace refactor for topic-first and exam-scope flows
**Task ID:** 08
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-08
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260426-140008

Task title: Question bank workspace refactor for topic-first and exam-scope flows
## Objective
Refactor the question-bank workspace so topic-first authoring is primary and exam scope is supported explicitly.
## Scope
- Topic-first practice/class-test authoring
- Subject/term exam-draft authoring with optional topic subset
- Fallback manual target-topic only when context truly lacks a resolvable topic
- Distinct save/load behavior for multiple drafts from the same broad planning source set
## Checklist
- No checklist yet.
## Definition of Done
- Question-bank flow feels context-first instead of source-first
- Exam drafts are clearly subject-scoped
- Saved drafts remain distinct and reload reliably
## Expected Artifacts
- Question-bank page refactor
- Exam-scope selection UI
- Updated persistence/load behavior
## Dependencies
- 02
- 03
- 06
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Completion Notes
- Completed through Takomi orchestration. See session artifacts and `T11_Verification_and_Rollout_Handoff.md` for implementation, verification, and manual UI test notes.
