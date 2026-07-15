# Admin Manual Report-Card Adjustments

## Goal

Give school administrators a controlled exception workflow for cumulative annual results when the standard three-term average is not appropriate, without changing the original CA/exam records.

## Admin Workflow

The admin-only route is:

- `/assessments/report-cards/manual-adjustments`

An administrator selects a session, cumulative annual term, class, and student. The workspace loads the report card's existing first-, second-, and third-term subject totals into a spreadsheet-style grid.

For each subject, the administrator can:

- choose the recorded terms included in the annual calculation
- use the selected-term count as the divisor
- optionally enter a final annual score override
- paste a vertical score column copied from Excel into the final-override cells
- reset the subject to the standard cumulative calculation

A reason is required for every save or reset.

## Calculation Rules

- Standard cumulative results still require first, second, and third term and divide by three.
- An adjusted result averages only the explicitly included terms.
- A missing value remains missing; a real score of `0` remains a recorded zero.
- The divisor is always the number of included terms.
- An optional final override replaces the computed adjusted average for grading.
- A valid manual adjustment completes the cumulative row and removes the print block for that row.

Example:

```text
First term: missing
Second term: 68
Third term: 74.3
Included terms: second + third
Divisor: 2
Annual result: (68 + 74.3) / 2 = 71.15
```

## Data Safety and Audit

- `assessmentRecords` are never changed by this workflow.
- Current adjustment state is stored in `reportCardManualAdjustments`.
- Every apply/reset action appends an immutable `reportCardManualAdjustmentEvents` record.
- Both mutations and reads are school-scoped and admin-only.
- Saved adjustments are keyed by school, student, session, report term, class, and subject.
- The normal report-card query applies the current adjustment during cumulative annual composition.

## Entry Points

- Admin workspace navigation: `Manual Adjustments`
- Admin dashboard system controls
- Missing-data warning on an individual report card

The printable report card remains clean; adjustment controls and audit reasons stay in the admin workspace.
