# T07 Admin Library Console

**Mode:** `vibe-continueBuild`  
**Workflow:** `/vibe-continueBuild`

## Agent Setup (DO THIS FIRST)

- Read `docs/features/LessonKnowledgeHub_v1.md`
- Inspect existing admin workspace patterns and navigation
- Use `takomi`, `frontend-design`, and `convex-functions`

## Objective

Build the admin library surface at `/academic/knowledge/library`.

## Scope

Included:

- library list
- search and filters
- owner and visibility badges
- material detail view
- admin override actions

Excluded:

- template studio
- teacher editor

## Definition of Done

- Admin can search and filter the school library.
- Admin can inspect ownership, labels, processing status, and visibility.
- Admin can archive, relabel, approve, reject, or reclassify content.

## Expected Artifacts

- admin route and components
- Convex query/mutation integration
- empty, loading, and failure states

## Constraints

- Preserve current admin visual language.
- Do not expose student-facing actions here without clear approval labeling.

## Verification

- Admin override actions round-trip correctly through Convex.
- Search and filters match stored metadata and visibility states.
