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
