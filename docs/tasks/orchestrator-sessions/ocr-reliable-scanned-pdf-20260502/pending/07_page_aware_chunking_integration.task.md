# Page-Aware Chunking Integration

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-build` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before implementation.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Build handoff conventions |
| convex-functions | Internal mutations and chunk writes |

## Role

Backend Engineer.

## Recommended Model

GPT-5.4.

## Objective

Ensure OCR results create idempotent page-aware chunks that respect selected page ranges.

## Files Likely Touched

- `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts`

## Dependencies

- Task 05 complete.
- Task 06 complete.

## Acceptance Criteria

- OCR chunks include `pageStart`, `pageEnd`, and `pageNumbers`.
- Page ranges such as `1-5,7-8` index only those pages.
- Retrying OCR replaces relevant existing chunks without duplicates.
- Mixed native/OCR behavior does not leak unselected pages into search or AI grounding.
- Chunk writes stay within Convex transaction limits or are batched safely.

## Verification Commands

- `pnpm typecheck`
- Unit tests for selected-page filtering and chunk metadata if available
