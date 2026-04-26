# T11 Question Bank And CBT Drafts Result

## Outcome

`T11` is complete. Teachers now have a dedicated question-bank workspace at `/planning/question-bank` for authoring editable question-bank drafts and CBT drafts from selected planning-library sources.

## What Changed

### Teacher route and UI
- Added the teacher assessment drafting route:
  - `apps/teacher/app/planning/question-bank/page.tsx`
- Added the editable question-bank / CBT workspace UI:
  - `apps/teacher/app/planning/question-bank/components/QuestionBankWorkspaceScreen.tsx`
  - `apps/teacher/app/planning/question-bank/types.ts`
- Added planning-library handoff into the new workspace:
  - `apps/teacher/app/planning/library/page.tsx`
- Updated teacher planning navigation matching so the route stays within the planning lane:
  - `packages/shared/src/workspace-navigation.ts`

### AI generation route
- Added the canonical assessment generation route:
  - `apps/teacher/app/api/ai/question-bank/generate/route.ts`
- The route now:
  - accepts `draftMode` plus selected `sourceIds`
  - generates `question_bank_draft` or `cbt_draft` output via `packages/ai`
  - records AI run logs
  - saves the resulting draft back into Convex as structured assessment rows

### Convex persistence
- Added the assessment drafting backend:
  - `packages/convex/functions/academic/lessonKnowledgeAssessmentDrafts.ts`
- Uses the existing shared schema tables already staged for this lane:
  - `assessmentBanks`
  - `assessmentBankItems`
- Also updated search/codegen artifacts touched by the new lane:
  - `packages/convex/schema.ts`
  - `packages/convex/functions/academic/lessonKnowledgeSearch.ts`
  - `packages/convex/_generated/api.d.ts`

## Delivered Behavior

- Teachers can open `/planning/question-bank` from selected planning-library sources.
- Supported draft modes:
  - `practice_quiz`
  - `class_test`
  - `exam_draft`
- `practice_quiz` and `class_test` resolve to `question_bank_draft` generation.
- `exam_draft` resolves to `cbt_draft` generation.
- Generated assessment items are persisted item-by-item in `assessmentBankItems`, not as a single opaque blob.
- Teachers can edit:
  - question type
  - difficulty
  - prompt text
  - answer text
  - explanation text
  - marks
  - tags
- Draft banks save and reload by school-scoped source context.
- AI run logging is recorded against the saved assessment bank.

## Reviewer Fixes Applied

The first implementation pass was not accepted blindly. Reviewer fixes were applied before completion:
- prevented unrelated previous assessment banks from being reused when the selected source set changes
- tightened assessment-draft save authorization so source materials must be both:
  - in the same school, and
  - actually usable by the current actor
- added teacher planning-nav matcher support for `/planning/question-bank`

## Verification

- `pnpm convex:codegen`
- `pnpm -C packages/convex typecheck`
- `pnpm -C packages/convex lint`
- `pnpm -C packages/shared typecheck`
- `pnpm -C apps/teacher typecheck`
- `pnpm -C apps/teacher lint`

## Notes

- Teacher lint still reports the same unrelated pre-existing warnings in the exam-entry area; there are no new T11 lint errors.
- Generated lesson-plan / student-note / assignment artifacts still do not have a publish/review/admin-visibility UI yet. That remains a known follow-up gap outside T11 scope.
- Assessment draft saves currently replace a bank's item rows on save; this remains item-by-item persistence and stays within the T11 authoring scope.
