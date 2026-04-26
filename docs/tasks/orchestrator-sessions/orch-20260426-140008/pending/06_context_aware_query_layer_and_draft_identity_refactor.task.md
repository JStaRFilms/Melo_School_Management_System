# Task: Context-aware query layer and draft identity refactor
**Task ID:** 06
**Stage:** build
**Status:** pending
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-06
**Workflow:** vibe-build
**Model Override:** oauth-router/gpt-5.5
## Context
Parent session: orch-20260426-140008

Task title: Context-aware query layer and draft identity refactor
## Objective
Implement backend support for topic-context and exam-scope retrieval plus stable draft identity.
## Scope
- Add or refactor Convex queries/mutations for topic workspace context
- Add or refactor Convex queries/mutations for subject-term exam scope
- Make draft identity distinguish source set, topic context, and exam scope safely
- Preserve backward compatibility for existing drafts where practical
## Checklist
- No checklist yet.
## Definition of Done
- Backends can load topic-bound workspaces and exam-scope workspaces deterministically
- Refresh and resume remain stable for saved drafts
- Broad planning references work as reusable sources rather than forced topic bindings
## Expected Artifacts
- Convex query/mutation updates
- Draft identity rules in code
- Regression-safe matching logic
## Dependencies
- 01
- 03
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains