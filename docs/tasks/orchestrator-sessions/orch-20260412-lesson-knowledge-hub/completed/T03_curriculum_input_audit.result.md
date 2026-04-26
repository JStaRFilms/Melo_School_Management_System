# T03 Curriculum Input Audit Result

## Outcome

`T03` is complete. The two sample PDFs under `docs/School curriculim example/` were audited as the grounded reference pair for the first lesson-knowledge slice.

## File Inventory and Intended Usage

- `2ND TERM JS 1 SOCIAL STUDIES.pdf` — canonical curriculum scheme-of-work sample; source for label extraction, week/topic names, and the first subject/level/term evidence.
- `JSS1 SOCIAL STUDIES SECOND TERM LESSON NOTES.pdf` — reference lesson-note sample; source for the expected output section order and level of detail.

## Sample-Grounded Assumptions

- Subject: Social Studies
- Level: JS 1 / JSS 1 (Basic 7)
- Term: Second Term / 2nd Term

## Label and Topic-Naming Notes

- Use the week/topic title as the primary topic label.
- Preserve source phrasing closely instead of aggressively normalizing titles. The curriculum sample and the lesson-note sample align on subject, level, and term, but they do not present perfectly identical week titles beyond the revision opening.
- Normalize `JS 1`, `JSS 1`, and `Basic 7` into one structured level field in future implementation, while preserving the source wording for display and audit traceability.
- Keep this audit descriptive only; no OCR, extraction pipeline, or product code work was introduced.

## Output-Structure Notes

- Keep the lesson-note shape aligned to the sample sections: Subject, Class, Term, Topic, Duration, Learning Objectives, Content, Teacher's Activity, Students' Activity, Evaluation, Weekend Assignment.
- Allow a revision-first week, since the reference lesson notes begin with a revision topic.
- Expect week-by-week lesson output rather than a single term-long document shape.
- Treat the curriculum PDF as the scheme-of-work/source-label reference and the lesson-note PDF as the richer output-structure reference.

## Verification

- Confirmed both sample files still exist at `docs/School curriculim example/`.
