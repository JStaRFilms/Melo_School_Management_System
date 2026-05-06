# Task 11: Final Verification, Docs, and Deploy

## Agent Setup

Do this after tasks 02-10 are complete or explicitly deferred.

Read:
- `master_plan.md`
- `DevLog_Audit_Ledger.md`
- completed task notes
- changed `docs/features/*.md`
- `packages/convex/_generated/ai/guidelines.md`

Use these skills where available:
- `takomi`
- `mode-review`
- `vibe-syncDocs`
- `vibe-finalize`
- `convex-security-check`
- `webapp-testing`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Reviewer / Orchestrator.
- Provider/model: `oauth-router/gpt-5.5`.
- Reasoning effort: High.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: High.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Final regression, documentation, and deploy gate.

## Objective

Verify the whole DevLog orchestration session, update documentation, deploy Convex, and produce the final orchestrator summary.

## Scope

- Confirm every DevLog item has a final status/comment.
- Confirm docs were updated for every feature changed.
- Run targeted tests/typechecks/builds for changed apps and packages.
- Run browser checks for high-risk UI flows.
- Run `pnpm convex deploy` at the end.
- Create `Orchestrator_Summary.md`.

## Required Output

Create `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/Orchestrator_Summary.md` with:

- tasks completed/deferred
- DevLog item coverage
- files changed by workstream
- verification commands and results
- `pnpm convex deploy` result
- remaining risks and recommended next session

## Acceptance Criteria

- No changed feature lacks documentation.
- Convex deploy result is recorded.
- Any failed verification has a clear reason and next action.
- Summary is concise enough for handoff but complete enough for another agent to resume.
