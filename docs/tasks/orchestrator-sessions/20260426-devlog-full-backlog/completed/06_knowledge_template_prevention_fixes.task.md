# Task 06: Knowledge and Template Prevention Fixes

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/features/LessonKnowledgeHub_v1.md`.
- Read `docs/features/LessonKnowledgeHub_v2_ContextFirstPlanning.md`.
- Inspect admin knowledge library, templates, and assessment profile routes.
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
- Provider/model: `oauth-router/gpt-5.4`.
- Reasoning effort: High.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: Medium.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Escalate for duplicate-prevention architecture or data integrity issues.

## Objective

Fix confirmed admin knowledge/template regressions while preventing new duplicate template/catalog entries.

## Scope

- Prevent future duplicate knowledge/template/catalog entries.
- Do not auto-clean existing duplicates in this pass.
- Fix the template catalog navigation bug so changing catalog from monitor/designer flows returns to the previous page/context.
- Audit Knowledge Library, Template Studio, and Assessment Profiles for loading and UI regressions.
- Implement only confirmed defects from the audit.

## Acceptance Criteria

- New duplicate template/catalog entries are blocked or clearly handled.
- Existing duplicates remain intact unless the user explicitly approves cleanup later.
- Catalog changes preserve the user's originating page/context.
- Admin knowledge pages remain mobile-friendly and do not gain verbose helper copy.
- Relevant docs are updated.
- Browser verification covers the navigation regression.

## Completion Notes

- Status: Completed on 2026-05-08.
- Template Studio now preserves the active workspace mode when switching catalog entries or output-type catalogs, so monitor stays on monitor and designer stays on designer.
- Template duplicate prevention was hardened around the normalized template applicability key. New active duplicates are blocked using a complete indexed lookup, while legacy duplicate records can remain and still be edited without forcing cleanup in this pass.
- Assessment Profiles now return the saved profile id to the screen, which fixes the new-profile save flow and keeps the saved profile selected instead of leaving the page stuck on an unsaved `new` draft.
- Assessment profile names are now blocked from creating new school-scoped duplicates using a complete school lookup while still allowing legacy duplicate rows to remain unchanged unless they are explicitly renamed later.
- Knowledge Library archive actions are now wired to the existing admin state mutation instead of rendering a dead archive control.
- No automatic duplicate cleanup or data rewrite was performed for existing template, topic, or profile rows.
- Documentation updated in `docs/features/LessonKnowledgeHub_v1.md` and `docs/features/Template_Studio_Redesign.md`.

## Verification

- `pnpm --filter @school/admin typecheck` - passed.
- `pnpm typecheck` - passed (`16 successful, 16 total`, 8m10.913s).
- Browser verification: pending. Navigation regression was verified at code level by preserving `editorMode` across catalog selection and output-type switches in `InstructionTemplateStudioScreen`, which is the exact state transition that previously forced a return to designer mode. A logged-in browser smoke check should still confirm monitor/designer catalog switching before final Task 11.
