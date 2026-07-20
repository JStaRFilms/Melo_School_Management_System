# T019 - Admin curriculum readiness dashboard

## Objective

Build the exact-context readiness dashboard and add discoverable admin navigation for Curriculum Intelligence.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Build `/academic/knowledge/curriculum-readiness` using required subject, active term, and normalized level context.
- [x] Show aggregate preparation counts plus per-topic source/lesson/note/assignment/assessment/publication evidence.
- [x] Preserve the explicit disclaimer that readiness does not confirm a topic was taught.
- [x] Provide useful loading, empty, invalid-context, and responsive mobile/table states.
- [x] Add Curriculum Import and Readiness entries to admin navigation without altering unrelated routes.
- [x] Keep every new code file under 200 lines and reuse existing Admin UI primitives/tokens.
- [x] Pass admin/shared typechecks, navigation tests if affected, scoped lint, and whitespace checks; no deploy.

## Notes

Design direction: the same compact editorial academic-operations language as the import workflow, with restrained evidence colors and scan-friendly status cells. Own the readiness route/components/helpers and minimal shared admin navigation entries/tests. Do not edit import UI/backend, AI/Convex lifecycle, or report-card files. Use `apply_patch`; no codegen/install/deploy/stage/commit.

## Update 2026-07-18T02:18:50

UI batch started.

## Outcome 2026-07-18

- Added the admin readiness route with active-session term resolution, subject/class context controls, aggregate preparation counts, evidence table, and exact server disclaimer.
- Added Curriculum Import and Curriculum Readiness links to the shared admin navigation, covered by navigation tests.
- Verified with admin/shared typechecks, shared test suite (76 tests), scoped ESLint, and `git diff --check`. No deploy, code generation, staging, or commit was performed.

## Update 2026-07-18T02:25:35

Readiness dashboard and navigation complete. Admin/shared typechecks, 76 shared tests, lint, and whitespace checks pass.
