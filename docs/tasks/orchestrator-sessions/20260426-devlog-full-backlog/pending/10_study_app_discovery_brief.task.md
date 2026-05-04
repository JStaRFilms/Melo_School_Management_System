# Task 10: Study App Discovery Brief

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/project_requirements.md`.
- Read portal and knowledge hub docs.
- Prime with Takomi `vibe-primeAgent`; use planning/discovery mode only.

Use these skills where available:
- `takomi`
- `convex`
- `nextjs-standards`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Architect.
- Initial model: `gpt-5.5`.
- Review model: `gpt-5.4`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Product/data-boundary discovery only; no code changes.

## Objective

Turn the standalone study app idea into a discovery brief, not an implementation task.

## Scope

- Define how a future study app could work independently while integrating with Melo schools when available.
- Clarify identity models for standalone students, Melo students, parents, and school-linked accounts.
- Identify shared knowledge, community, game-score, metrics, and portal integration boundaries.
- Identify what must not be built in this DevLog session.

## Required Output

Create `docs/features/StandaloneStudyAppDiscovery.md`.

## Acceptance Criteria

- The brief separates standalone app capabilities from Melo-integrated capabilities.
- Data ownership and privacy boundaries are explicit.
- The brief lists open product questions for a future planning session.
- No app code is changed.
