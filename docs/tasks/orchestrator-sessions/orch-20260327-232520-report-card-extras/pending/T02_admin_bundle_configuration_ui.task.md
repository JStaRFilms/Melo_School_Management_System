# T02 Admin Bundle Configuration UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `nextjs-standards`, and `avoid-feature-creep`.
- Do not begin until `T00` is approved and `T01` is complete.

## Objective

Build the admin-facing UI for reusable scales, bundle authoring, preview, and multi-class assignment.

## Write Scope

- `apps/admin/app/assessments/setup/report-card-bundles/**`

## Responsibilities

- reusable scale template management
- bundle sections and field definition UI
- section/field reordering
- live preview
- fast multi-class assignment with search/filter/bulk-select

## Definition Of Done

- admin can create, edit, and assign bundles
- admin can attach one bundle to many classes and many bundles to one class
- UI stays modular and mobile-aware
- route uses only the stable APIs from `T01`

## Constraints

- no drag-and-drop requirement if a simpler reorder control is cleaner and faster
- no per-field conditional builder logic
