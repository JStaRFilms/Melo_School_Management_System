# T44 OCR Notes and AI Assessment Flows

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-file-storage` and `prompt-engineering`.
- Do not use `context7`.

## Objective

Implement the upload, OCR, prompt orchestration, and editable output flows for handwritten lesson notes and generated quizzes or CBTs.

## Scope

Included: file upload path, OCR processing orchestration, prompt templates, editable AI outputs.  
Excluded: advanced curriculum ingestion beyond what the existing product scope establishes.

## Context

This task fulfills `FR-016` and should integrate into the teacher workspace cleanly.

## Definition of Done

- Teachers can upload source material.
- OCR and AI output become editable artifacts.
- Generated quiz or CBT content can be reviewed before use.

## Expected Artifacts

- file-handling flows
- AI prompt and generation services
- teacher-side editing interfaces or hooks

## Constraints

- Rate-limit expensive AI flows.
- Log actions for auditability and support.

## Verification

- Representative OCR and quiz-generation flows complete successfully and return editable output.

