# Platform school enrollment visibility

## Goal

Show the platform super admin the current student enrollment for each school on `/schools` without granting access to student records.

## Count definition

A current student is a `students` row that:

- is not archived
- has `enrollmentStatus: "active"`
- or has no enrollment status because it predates the lifecycle field

Withdrawn, suspended, graduated and transferred-out rows do not count. User-account archive state, canonical memberships and commercial billing rules do not redefine this student-row measure.

The number is an enrollment headcount. It is not a payment total, a billable-roster snapshot, or evidence that the school used the product today.

## Backend components

- `schoolEnrollmentCounts` stores one materialized count per school.
- Student lifecycle mutations update the count in the same transaction as the student change, event and enrollment-period evidence.
- Withdrawal and suspension subtract an eligible row. Re-enrollment and reinstatement add it back on the same identity with a new period.
- Archive/restore adjust only active or legacy-absent rows. Restoring an inactive record does not add a student or reopen its period.
- Governed transfers update both schools atomically. Graduation corrections require the current matching graduation and cannot activate a subsequently departed student.
- Identical transition retries return the original result with no count writes, including an old departure retry after return. An invalid or underflowing delta rolls back the whole mutation.
- New schools start with a count of zero.
- `recalculateSchoolEnrollmentCount` lets an authenticated platform admin create or repair the count from the source student rows.
- `listSchools` returns only the count. It does not return student identities or records.

A missing count is returned as `null`. The UI labels it "Not calculated" instead of showing a false zero.

## Data flow

1. A school admits, withdraws, suspends, re-enrolls, reinstates, archives, restores, graduates, corrects graduation, imports, or transfers a student.
2. The mutation changes the student row and adjusts `schoolEnrollmentCounts` in the same Convex transaction.
3. The platform `listSchools` query reads the materialized count.
4. The `/schools` table and mobile card show the value.

## Database schema

```text
schoolEnrollmentCounts
  schoolId: Id<"schools">
  currentStudentCount: number
  updatedAt: number

index: by_school [schoolId]
```

## Existing-school backfill

Existing schools have no counter row after the schema deploy. Their row displays `Calculate`, which calls `recalculateSchoolEnrollmentCount` once for that school. The mutation reads at most 10,000 student rows and fails rather than publishing a partial count if a school exceeds that bound.

## Authorization

Only an authenticated, active platform admin can list schools or recalculate a count. The response exposes an aggregate number only. School users cannot query cross-school counts through this contract.

## UI

Route: `/schools`

Desktop adds a `Students` column. Mobile cards add a `Current students` row. Missing counts display a `Calculate` action so the platform admin can initialize an existing school's count.

## Local verification

B3 tests render both the real desktop table and mobile school cards with aggregate zero/null values, then update the subscribed count. Zero is numeric; null remains "Not calculated" with Calculate. Calculation busy/error states do not fabricate a zero or replace subscription data. No directory query or student identity is used by these consumers.

B1 tests exercise registered admission/transition/archive/restore/graduation and governed transfer paths. They compare initialized values with source-row snapshots, check zero versus missing/null, reject stale or altered operations, roll back underflow, reject unauthorized/inactive Platform identities and fail recalculation above 10,000 rows without publishing a partial count. Released reports and issued invoices remain separate evidence. No backend deployment or Platform browser session has been run. Platform browser proof is BLOCKED pending a separately attested origin, account and school fixture; Admin or Parent QA is not that proof.

## Out of scope

- last login or "active today"
- student identity drill-down
- payment volume
- billable roster calculation
- historical enrollment charts
