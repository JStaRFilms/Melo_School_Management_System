# Task 08: Portal and Teacher Knowledge Refactors

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read results from task 06.
- Read `docs/features/PortalAcademicPortalFoundation.md`.
- Read `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`.
- Inspect teacher library, videos, planning subpages, and portal knowledge surfaces.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Coder.
- Provider/model: `oauth-router/gpt-5.5`.
- Reasoning effort: Medium.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: High.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Cross-file refactor; preserve behavior.

## Objective

Modularize the student/parent portal page and audit/fix the teacher and portal knowledge systems.

## Scope

- Split the monolithic portal workspace/page into focused components and hooks without behavior changes.
- Audit teacher library and subpages, including video page.
- Audit portal knowledge/learning surfaces.
- Align fixes with the context-first planning model.
- Keep library as repository, not primary authoring launcher.

## Acceptance Criteria

- Portal page is easier to maintain and no longer monolithic.
- Existing portal results, report cards, billing, notifications, and learning behavior still work.
- Teacher knowledge pages load correctly and respect assigned school/class/subject boundaries.
- Portal knowledge surfaces expose only approved student-facing resources.
- Docs and verification notes are updated.
