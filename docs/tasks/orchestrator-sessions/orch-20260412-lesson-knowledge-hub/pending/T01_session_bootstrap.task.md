# T01 Session Bootstrap

**Mode:** `mode-orchestrator`  
**Workflow:** `/mode-orchestrator`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Read `docs/tasks/orchestrator-sessions/orch-20260412-lesson-knowledge-hub/master_plan.md`
- Use `takomi`, `spawn-task`, and `avoid-feature-creep`

## Objective

Validate that the new session shell is coherent, dependency-safe, and ready to become the source of truth for this domain.

## Scope

Included:

- session directory structure
- task ordering
- registry alignment
- backlog isolation from older sessions

Excluded:

- product implementation
- schema or route changes

## Definition of Done

- Session docs are internally consistent.
- Task ordering matches the dependency plan.
- The session is explicitly separate from `orch-20260404-193645-relaunch`.
- Any missing orchestration artifact is added and documented.

## Expected Artifacts

- validated `master_plan.md`
- validated `Orchestrator_Summary.md`
- short result note moved with the task on completion

## Constraints

- Do not merge this queue into a legacy or unrelated session.
- Keep the session focused on the locked v1 scope.

## Verification

- Confirm all referenced files exist.
- Confirm `T01-T15` task references are dependency-safe.
