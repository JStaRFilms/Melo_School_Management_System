# Current OCR Attempt Inventory

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-genesis` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before analysis.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow orchestration handoff conventions |
| convex | Understand Convex backend boundaries |

## Role

Takomi Genesis Analyst.

## Objective

Inventory the current OCR and PDF extraction implementation so build agents know exactly what to keep, replace, or remove.

## Inputs

- `packages/convex/_generated/ai/guidelines.md`
- `packages/convex/functions/academic/lessonKnowledgeIngestion.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestionActions.ts`
- `packages/convex/functions/academic/lessonKnowledgePdfExtraction.ts`
- `packages/convex/functions/academic/lessonKnowledgeIngestionHelpers.ts`
- `apps/teacher/app/planning/library/page.tsx`
- `apps/teacher/features/planning-library`

## Outputs

- A concise inventory document in this session directory, named `current_ocr_inventory.md`.

## Acceptance Criteria

- Identifies native PDF extraction paths.
- Identifies OpenRouter/Gemma fallback paths.
- Identifies browser-prepared OCR retry paths.
- Identifies selected-page trimming behavior.
- Identifies all public retry/upload mutations/actions affected.
- Calls out compatibility risks and likely removal/refactor points.
- Does not modify implementation code.
