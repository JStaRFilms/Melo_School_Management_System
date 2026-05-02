# Teacher OCR UX Design

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-design` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before design work.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Design handoff conventions |
| nextjs-standards | Keep teacher app UI conventions |
| frontend-design | Keep UX practical and polished |

## Role

Product/UI Planner.

## Recommended Model

GPT-5.4.

## Objective

Specify the teacher-facing OCR states and retry flow for `/planning/library`.

## Inputs

- `apps/teacher/app/planning/library/page.tsx`
- `apps/teacher/features/planning-library/components`
- `docs/features/ReliableScannedPdfOcrFallback.md`
- `docs/features/SmartPdfPageSelectionAndPageAwareIndexing.md`

## Outputs

- `teacher_ocr_ux_design.md` in this session directory.

## Acceptance Criteria

- Defines labels and copy for `ocr_needed`, queued, processing, ready, and failed states.
- Defines when `Run OCR`, `Retry OCR`, and `Upload clearer copy` appear.
- Removes re-upload as the normal retry path.
- Preserves selected-page summary.
- Covers mobile and desktop planning-library surfaces.
- No implementation code is changed in this Design task.
