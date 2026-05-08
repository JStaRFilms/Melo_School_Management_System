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

## Completion Notes

- Status: Completed on 2026-05-08.
- Portal workspace entry was split into a small wrapper plus focused portal-workspace modules for the live workspace content, Convex fallback preview, and formatting helpers. Existing dashboard, results, report-card, notification, billing, and payment behavior was preserved.
- Teacher library/video ingestion was hardened so teacher-created uploads and YouTube submissions must match one of the teacher's assigned class/level and subject pairings. Teacher uploads now require an assigned subject even for curriculum/planning-reference paths; school admins retain school-wide setup authority.
- Portal learning topic queries now accept selected student context for parent viewers and reject topic page reads when the selected child is not in the topic's class level.
- Portal supplemental upload/finalize mutations and original-file downloads now also carry selected child context, preventing parent multi-school sessions from falling back to the first child.
- Portal topic material exposure remains gated through existing `canReadKnowledgeMaterialOnPortal` approval/visibility checks and topic/class bindings.
- Direct supplemental upload requests now reject draft/retired topics, matching the topic page read path.
- Documentation updated in `docs/features/PortalAcademicPortalFoundation.md` and `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`.

## Verification

- `pnpm --filter @school/portal typecheck` - passed.
- `pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false` - passed.
- `pnpm -C apps/portal exec tsc --noEmit --incremental false --pretty false` - passed.
- `pnpm typecheck` - passed (`16 successful, 16 total`, 4m41.654s on rerun; first run timed out after portal/teacher/admin builds had passed but before all typecheck tasks finished).
- Browser verification: pending. Code-level checks covered route builds for portal learning topics, dashboard/report-card/results/billing routes, and teacher planning/video routes during `pnpm typecheck` because the repo typecheck pipeline also runs the Next builds.
