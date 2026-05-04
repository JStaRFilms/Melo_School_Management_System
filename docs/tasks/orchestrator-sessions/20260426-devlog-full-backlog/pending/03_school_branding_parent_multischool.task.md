# Task 03: School Branding and Parent Multi-School Context

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/project_requirements.md`.
- Read `docs/features/PortalAcademicPortalFoundation.md`.
- Read tenant/domain/public-site docs if branding touches public surfaces.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `convex-security-check`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Architect / Coder.
- Initial model: `gpt-5.5`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Security-sensitive tenant context and parent multi-school access.

## Objective

Make each authenticated workspace clearly show the active school, and add the first parent multi-school context flow.

## Scope

- Show school name/logo/theme in admin, teacher, and portal navigation/dashboard context.
- Add dynamic browser metadata where feasible for active school context.
- Portal parents with children in multiple schools can see and choose the active child/school context.
- Student login remains direct to the student’s own school/student context.
- Preserve all school data boundaries and role restrictions.

## Acceptance Criteria

- Staff can tell which school they are using from dashboard/nav/browser title.
- Parent portal can represent children from multiple schools without leaking data across schools.
- Active context changes update visible school identity.
- Fallback branding remains usable when a school has no logo/theme.
- Relevant portal/branding docs are created or updated.
- Tenant-scope tests or explicit verification notes are included.
