# T05 Schema ACL Search Foundation

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Review `packages/convex/schema.ts`
- Use `takomi`, `convex-best-practices`, `convex-schema-validator`, and `convex-security-check`

## Objective

Add the Convex schema and guardrails for the lesson-knowledge domain.

## Scope

Included:

- new tables
- indexes
- role and visibility rules
- cross-school isolation
- search contracts

Excluded:

- full ingestion implementation
- app UI implementation

## Definition of Done

- All planned tables are added with defensible indexes.
- Teacher, admin, and student visibility rules are encoded.
- Search and retrieval contracts are clear enough for later task reuse.

## Expected Artifacts

- schema additions
- supporting Convex helper modules for auth and visibility
- brief verification note describing the chosen indexes

## Constraints

- Avoid storing high-churn editor state or growing child collections in one document.
- Keep teacher uploads private by default.
- Student-facing visibility must require teacher or admin approval.

## Verification

- Schema validates.
- Cross-school and cross-role checks are exercised with targeted tests or function-level verification.
