# Teacher assigned roster

A Teacher selects an academic context, sees assigned pupils, and can reopen the same context after reload. This recipe does not write scores or finalize a sheet.

## Sub-features

- `dependent-selectors`: Session enables Term, then Class, then Subject.
- `assigned-roster`: the seeded Mathematics context includes Alice Johnson.
- `reload-context`: academic selectors and the roster survive reload through the route query.
- `mobile-roster`: controls remain visible and the page avoids horizontal overflow.
- Score validation/save/recovery, session scoring changes, finalization, narrative comments, and historic report printing require separate feature-specific checks.

## How to get to it (user POV)

- Teacher workspace, Score Entry, at `/assessments/exams/entry`.
- An exam-entry deep link can preselect the context; this additional entry point needs separate assertions when changed.

## Driving it with qa

Preconditions: Teacher and Admin are owned servers because the baseline Teacher journey also checks rejection from Admin. Use the synthetic Teacher account, with Session `2025/2026`, Term `First Term`, Class `JSS 1 - A`, and Subject `Mathematics`.

Run `pnpm qa:roles --roles teacher`. Expect each named selector to enable in order, a row for Alice Johnson, and the sheet action controls. Reload and assert the checked options plus the same pupil. Inspect roster and mobile evidence. This proves loading/selection, not successful recording or publication of results.

For score-entry changes, author an approved synthetic-write module. Establish a recoverable test row, test invalid and valid values, save through the UI, reload, confirm unchanged unrelated pupils, and report any ambiguous save before retrying. Keep finalization and result release as separately declared criteria.

## Gotchas

- Visible labels must be associated with controls. Use their accessible names rather than numeric selector positions.
- A newly merged entry-mode function may be absent from the isolated backend. That is a contract blocker, not a reason to hide the query or switch databases.
- An assigned roster and a visible Finalize Sheet button do not establish editing-window, write authorization, scoring-policy, or release correctness.
