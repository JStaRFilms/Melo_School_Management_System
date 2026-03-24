# T01 Exam Recording Blueprint

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-genesis`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-genesis`.
- Run `/vibe-primeAgent`.
- Load `takomi` and `avoid-feature-creep`.
- Do not use `context7`.

## Objective

Create or replace the exam-recording sub-PRD at `docs/features/ExamRecording.md`.

## Scope

Included:
- feature goal
- in-scope and out-of-scope
- teacher vs admin responsibilities
- school-wide exam input mode
- grading bands
- data model
- validation rules
- calculation rules
- permissions
- audit fields
- future-ready notes
- acceptance criteria

Excluded:
- actual app code
- mockups
- report cards, ranking, moderation

## Context

Use:
- `docs/Project_Requirements.md`
- `docs/Coding_Guidelines.md`
- `docs/issues/FR-006.md`
- `docs/issues/FR-007.md`

The v1 rule is:
- CA1, CA2, CA3 are out of 20
- Exam contribution is out of 40
- School exam mode is either `raw40` or `raw60_scaled_to_40`
- If `/60`, scale with `(rawExam / 60) * 40`
- Round scaled exam and total to 2 decimals

## Definition Of Done

- `docs/features/ExamRecording.md` is complete and implementation-ready.
- The doc clearly excludes ranking, CGPA, report cards, moderation, student-by-student entry, and teacher overrides.
- The doc is specific enough that design and build tasks do not need to invent product behavior.

## Expected Artifacts

- `docs/features/ExamRecording.md`

## Constraints

- Keep the scope narrow.
- Keep school tenancy explicit.
- Treat any existing draft file as replaceable if it is incomplete or inconsistent.

## Verification

- Confirm the doc contains calculation and validation rules.
- Confirm permissions are spelled out separately for teacher and admin.
- Confirm acceptance criteria reflect the narrowed v1.
