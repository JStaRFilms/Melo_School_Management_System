# T05 Schema ACL Search Foundation Result

## Outcome

`T05` is complete. The lesson-knowledge Convex foundation now has school-scoped schema tables, visibility guardrails, search contracts, and targeted helper tests.

## What Changed

- added lesson-knowledge validators and tables to `packages/convex/schema.ts`
- added school/topic/material/artifact/assessment/audit tables with defensible school-first indexes
- added helper modules for access control and search contracts:
  - `packages/convex/functions/academic/lessonKnowledgeAccess.ts`
  - `packages/convex/functions/academic/lessonKnowledgeSearch.ts`
- added targeted role/boundary tests for the new helper layer
- generated Convex bindings and verified the package with typecheck, lint, and focused tests

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `cd packages/convex && pnpm exec vitest run functions/academic/__tests__/lessonKnowledgeAccess.test.ts`
- `pnpm -C packages/convex lint`

## Notes

- Teacher-owned uploads remain private by default in the helper layer.
- Student portal visibility requires `student_approved`, approved review state, matching class context, and topic attachment.
- Template resolution support now includes a dedicated `schoolId + outputType + isSchoolDefault` index for the school-default fallback path.
- Search contracts are intentionally school-scoped and point at `searchText` indexes for later retrieval work.
