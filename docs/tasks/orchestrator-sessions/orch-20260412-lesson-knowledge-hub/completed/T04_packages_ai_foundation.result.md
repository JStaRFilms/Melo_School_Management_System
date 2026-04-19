# T04 Packages AI Foundation Result

## Outcome

`T04` is complete. A new shared workspace package, `packages/ai`, now centralizes the OpenRouter-backed AI SDK setup for document generation.

## What Changed

- added `packages/ai` with package/tsconfig/README scaffolding
- centralized OpenRouter provider creation and model resolution in one typed config layer
- added typed generation contracts and schemas for:
  - `lesson_plan`
  - `student_note`
  - `assignment`
  - `question_bank_draft`
  - `cbt_draft`
- added prompt-builder skeletons for each document type
- added failure normalization and retry-delay helpers for AI run handling
- installed/verified workspace dependencies and ran package typecheck successfully

## Verification

- `pnpm install`
- `pnpm --filter @school/ai typecheck`
- `pnpm --filter @school/ai lint`

## Notes

- The package is document-generation oriented and intentionally does not introduce chat-first abstractions.
- Route handlers can import the package later without duplicating provider/model setup.
- Reviewer follow-up added the missing `src/config.ts` export target and a `./models` subpath so the package exports are internally consistent.
