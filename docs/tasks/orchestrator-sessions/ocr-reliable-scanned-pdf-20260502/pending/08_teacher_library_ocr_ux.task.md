# Teacher Library OCR UX

## Agent Setup

### Workflow to Follow

Read the Takomi `vibe-build` workflow first.

### Prime Agent Context

Run `vibe-primeAgent` before implementation.

### Required Skills

| Skill | Why |
| --- | --- |
| takomi | Follow Build handoff conventions |
| nextjs-standards | Teacher app conventions |
| frontend-design | Practical, polished state UX |

## Role

Frontend Engineer.

## Recommended Model

GPT-5.4.

## Objective

Update `/planning/library` so teachers can run/retry server-side OCR for stored PDFs without re-uploading.

## Files Likely Touched

- `apps/teacher/app/planning/library/page.tsx`
- `apps/teacher/features/planning-library/components/MaterialCard.tsx`
- `apps/teacher/features/planning-library/components/MaterialPreviewInspector.tsx`
- `apps/teacher/features/planning-library/components/MaterialEditSheet.tsx`
- `apps/teacher/features/planning-library/types.ts`

## Dependencies

- Task 04 complete.
- Task 05 complete.

## Acceptance Criteria

- `ocr_needed` materials show a clear server-side `Run OCR` action.
- Failed retryable OCR materials show `Retry OCR`.
- Teachers are not asked to choose the original PDF unless the stored file is missing/invalid.
- Selected-page summaries remain visible.
- Provider failures show safe teacher-facing messages.
- Buttons are disabled during in-flight actions to avoid duplicate requests.
- Mobile and desktop surfaces both expose the same core actions.

## Verification Commands

- `pnpm typecheck`
- Manual browser smoke test of `/planning/library`
