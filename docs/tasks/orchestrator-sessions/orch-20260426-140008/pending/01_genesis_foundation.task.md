# Task: Genesis foundation
**Task ID:** 01
**Stage:** genesis
**Status:** pending
**Role:** orchestrator
**Preferred Agent:** orchestrator
**Conversation ID:** orchestrator-01
**Workflow:** vibe-genesis
## Context
Parent session: orch-20260426-140008

Task title: Genesis foundation
## Objective
Establish the project foundation, produce the required planning docs, and decide what should split next.
## Scope
- Clarify scope and mission
- Create or update the core markdown artifacts
- Lock acceptance criteria and boundaries
- Recommend whether Design and Build should stay compact or expand
## Checklist
- [ ] Define the v2 planning model: topic-first for lesson/quiz work, subject-scope for exam work
- [ ] Specify library vs topic workspace vs exam workspace responsibilities
- [ ] Lock rules for broad planning references, topic-bound materials, and portal-facing resources
- [ ] Define migration/backward-compatibility expectations for existing lesson-plan/question-bank flows
- [ ] Recommend detailed Design and Build task fan-out for implementation
## Definition of Done
- Required planning markdown files exist or are updated
- Minimum usable state is explicit
- Genesis recommends the correct next Design and Build structure
## Expected Artifacts
- Requirements and feature docs
- Genesis brief
- Recommended task breakdown for later stages
## Dependencies
- None specified.
## Review Checkpoint
User or orchestrator approves the foundation before expanding later stages.
## Instructions
- treat this as the root task for the whole Genesis -> Design -> Build lifecycle
- create the required markdown artifacts before implementation begins
- split later-stage work only when the scope justifies it
- leave a clear recommendation for how Design and Build should fan out
## Notes
This session redesigns the Lesson Knowledge Hub from a source-first workflow into a context-first workflow. Primary planning flow should become Subject -> Level/Class -> Term -> Topic (or Subject -> Level/Class -> Term -> Exam scope for assessments). Broad planning references like curriculum PDFs remain library assets, but teacher authoring should launch from topic/exam context instead of from source selection alone. The library remains a library, while topic/exam workspaces pull in relevant sources and allow teachers to add more materials within that context.