# T07 Admin Library Console Result

## Outcome

`T07` is complete. The admin library console now exists at `/academic/knowledge/library` and supports school-scoped browsing, filtering, detail inspection, and admin overrides through Convex-backed mutations.

## What Changed

- added a new admin route and UI composition for the knowledge library:
  - `apps/admin/app/academic/knowledge/library/page.tsx`
  - `apps/admin/app/academic/knowledge/library/loading.tsx`
  - `apps/admin/app/academic/knowledge/library/error.tsx`
- added modular library UI components:
  - `apps/admin/app/academic/knowledge/library/components/KnowledgeLibraryFilters.tsx`
  - `apps/admin/app/academic/knowledge/library/components/KnowledgeMaterialList.tsx`
  - `apps/admin/app/academic/knowledge/library/components/KnowledgeMaterialCard.tsx`
  - `apps/admin/app/academic/knowledge/library/components/KnowledgeMaterialDetailPanel.tsx`
  - `apps/admin/app/academic/knowledge/library/components/types.ts`
- added Convex admin library query and mutation support:
  - `packages/convex/functions/academic/lessonKnowledgeAdmin.ts`
- broadened the knowledge material search contract and search index filters so admin search can key off stored metadata and state fields
- added the route to the admin workspace navigation:
  - `packages/shared/src/workspace-navigation.ts`
- kept the scope limited to admin library browsing and override actions; no template studio or teacher editor work was added

## Admin Library Capabilities

- search the school library
- filter by visibility, review state, source type, processing state, owner role, subject, and level
- inspect owner, labels, processing status, visibility, storage, bindings, and audit trail
- relabel a material and refresh its search snapshot
- approve, reject, archive, or reclassify visibility through Convex
- preserve loading and empty states, with route-level failure handling

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex exec eslint functions/academic/lessonKnowledgeAdmin.ts functions/academic/lessonKnowledgeSearch.ts functions/academic/lessonKnowledgeIngestionActions.ts`
- `pnpm -C packages/shared exec tsc --noEmit`
- `pnpm -C packages/shared exec eslint src/workspace-navigation.ts`
- `pnpm -C apps/admin typecheck`

## Notes

- The existing `apps/admin` ESLint script still hits a repo-level ESLint/Next config mismatch, so the verification here relies on TypeScript checks plus targeted lint runs where the config is usable.
- The admin console is intentionally focused on library review and override actions only.
