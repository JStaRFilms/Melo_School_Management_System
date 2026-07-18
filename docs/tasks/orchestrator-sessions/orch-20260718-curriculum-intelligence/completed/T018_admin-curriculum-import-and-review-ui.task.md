# T018 - Admin curriculum import and review UI

## Objective

Build the complete admin source/context selection, extraction progress, evidence-backed unit review, edit/reject, and approve workflow.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Add bounded admin list/detail queries for curriculum imports and units, including source/context labels and page evidence; server derives school/actor.
- [x] Build `/academic/knowledge/curriculum-import` with a compact, operational, responsive design matching existing AdminHeader/layout primitives.
- [x] Let an admin select a ready imported-curriculum source, subject, active term, and level; create the import and trigger the authenticated extraction endpoint.
- [x] Show idle/generating/failed/review states with safe retry guidance and exact model/provider metadata after completion.
- [x] Render evidence-backed unit rows/cards with week, topic, objectives, confidence, page/excerpt, warnings, and edit/reject/approve actions.
- [x] Prevent duplicate submission, show accessible busy/error/success feedback, and keep approval explicitly human-controlled.
- [x] Split hooks/components/helpers so every new code file remains under 200 lines.
- [x] Pass admin/Convex typechecks, focused lint/tests, and whitespace checks; no deploy/network generation call.

## Notes

Design direction: compact editorial academic-operations workspace—high information density, calm neutral surfaces, strong blue/emerald evidence/status accents, restrained motion, and existing Melo typography/tokens. Reuse existing Admin UI primitives; do not invent a separate design system. Own new import route/components/hooks plus a new curriculum admin read-query module/tests. Do not edit readiness files/navigation/report-card files. Use `apply_patch`; no codegen/install/provider calls/deploy/stage/commit.

## Update 2026-07-18T02:18:50

UI batch started.

## Outcome 2026-07-18

Added the school-admin-only curriculum import read model and the compact `/academic/knowledge/curriculum-import` workspace. The route selects only ready curriculum sources, an active term, subject, and level; it creates the server-authorized draft and invokes the existing authenticated extraction endpoint. The review queue exposes provider/model provenance, failed-generation guidance, evidence pages/excerpts, confidence and warnings, and explicit edit, reject, and approval actions. Approval remains separately confirmed by the administrator.

### Verification

- `pnpm --filter @school/admin typecheck` — passed.
- `pnpm --filter @school/convex typecheck` — passed.
- `pnpm exec eslint apps/admin/app/academic/knowledge/curriculum-import packages/convex/functions/academic/curriculumAdminRead.ts` — passed.
- `pnpm exec vitest run functions/academic/__tests__/curriculumLifecycle.test.ts` from `packages/convex` — passed (5 tests; existing Convex-test direct-call warnings only).
- `git diff --check` — passed (existing CRLF warnings only).

No code generation, provider request, deployment, staging, or commit was run.

## Update 2026-07-18T02:25:35

Admin import/review UI and bounded admin read model complete. Admin/Convex typechecks, lifecycle tests, lint, and whitespace checks pass.
