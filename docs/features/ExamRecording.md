# Exam recording

**Status:** Implemented

## Session-scoped scoring policies

The original v1 contract below is historical. Its fixed 20/20/20/40 weights and school-wide exam modes describe the legacy fallback, not the current only-supported configurations. For sessions with no explicit policy, legacy reads use recorded raw-exam maximum and available imported policy snapshots. Without a snapshot, legacy weights default to CA 20/20/20 and exam contribution 40. An empty session cannot recover its original school exam mode, so it uses the current effective school setting. Conflicting legacy snapshots in one session are mixed evidence, not a reliable session policy. Rows retain their own recorded exam maximum until an administrator applies an explicit policy.

An administrator can set a policy for an academic session, editing all five maxima: `ca1Max`, `ca2Max`, `ca3Max`, `examRawMax`, and `examContributionMax`. The three starter presets are:

- CA 20/20/20, exam raw /40 contributing /40
- CA 20/20/20, exam raw /60 contributing /40
- CA 20/20/10, exam raw /50 contributing /50

Presets are starters, not restrictions. Each maximum can be edited; valid policies have a total contribution of 100. Every maximum must be finite, between 0 and 100 with at most two decimal places; `examRawMax` must be greater than zero. Scores must be finite and within zero and their corresponding raw maximum. The exam contribution is `round(examRawScore / examRawMax * examContributionMax, 2)`, and total is the three CAs plus that contribution, rounded to two decimal places. Grading bands remain separate and must cover the resulting total.

Policy changes affect only the selected session. The admin flow scans all existing rows first, then permits confirmation only when the complete scan is ready and valid. A row above any proposed maximum blocks application and reports actionable class/subject examples; invalid scans hold the session guard until cancelled. Applying starts a guarded, batched regrade. It is not complete until polling reports `complete`; the final transaction publishes the policy version and audit event with the exact updated-row count. The guard blocks assessment entry, report reads/prints, certification, reviewed imports, and other assessment readers during scan/regrade. Failed batches stay guarded and can be resumed. Other sessions remain available.

Regrades preserve raw scores and record who changed the policy. Issued report payloads remain unchanged. Printing an issued report warns when its certified version predates the completed scoring policy. This warning is not a replacement certification workflow: administrators still need a recertification process, which has not been implemented. Newly prepared unissued reports do not carry this stale-issued-report warning.

Tests cover policy validity/calculation, 101-row regrades, multi-batch invalid counts and references, mixed raw40/raw60 legacy reads, explicit reconciliation, failure/resume, cancellation, governance changes, guarded reads and writes, tenant isolation, stale versions, legacy fallback, and issued-report warnings. See the session task backend handoff for API sequencing and operational details.

## Goal

Ship the first usable exam-recording workflow for primary-school operations so teachers and admins can enter continuous assessment and exam scores in one place, while the system calculates totals, grades, and remarks automatically using school-defined rules.

## Overview

This feature covers a single bulk-entry flow:

1. A teacher or admin logs in.
2. They choose a session, term, class, and subject.
3. The system loads every student in that class for that subject.
4. The user enters `CA1`, `CA2`, `CA3`, and `Exam`.
5. The system computes the final total out of `100`, derives the grade letter, and fills the matching remark.

This v1 is intentionally narrow so the team can ship a reliable core before adding ranking, report cards, and moderation.

## In Scope

- Primary-school exam recording only
- Teacher app bulk score-entry workflow
- Admin app bulk score-entry workflow
- Admin-managed school assessment settings
- Admin-managed grading bands
- School-wide exam input mode
- Auto-calculated totals, grades, and remarks
- School-scoped access control
- Audit-ready storage fields for who entered and updated records

## Out Of Scope

- Ranking and positions
- CGPA or cumulative aggregates
- Report-card generation or printing
- Approval, submission, moderation, or publishing workflow
- Student-by-student score entry UI
- Per-teacher or per-sheet exam scaling override
- Per-subject or per-class grading bands
- Manual remark editing per student

## User Roles

### Teacher

- Can open only assigned class-subject sheets within their school
- Can enter and edit scores on those sheets
- Can see the school's exam input mode but cannot change it

### School Admin

- Can manage school assessment settings
- Can manage grading bands
- Can open and edit any class-subject sheet within their school
- Can override score entries made by teachers

## App Responsibilities

### Teacher App

- Provide the session, term, class, and subject selector flow
- Render the bulk roster grid
- Validate score input ranges inline
- Show computed `Exam Contribution`, `Total`, `Grade`, and `Remark`
- Save score changes in bulk

### Admin App

- Provide the same bulk roster grid for school-wide oversight
- Provide the school assessment settings page
- Provide the grading-band management page
- Show validation feedback for incomplete or overlapping grade bands

## Entry Workflow

### Primary Flow

1. User opens the exam-entry page.
2. User selects:
   - academic session
   - academic term
   - class
   - subject
3. System loads:
   - class roster
   - any existing assessment records for that sheet
   - school assessment settings
   - active grading bands
4. User enters or updates scores.
5. System recalculates derived values immediately in the grid.
6. User saves the sheet.
7. System bulk-upserts assessment records and stores audit fields.

### Supported Entry Mode

- Bulk subject entry only

## Assessment Settings

Historical v1 behavior used one active school exam input mode. New session-scoped policies are described above.

### Supported Modes

- `raw40`
  - Teacher enters exam directly out of `40`
  - Exam contribution equals the raw exam score
- `raw60_scaled_to_40`
  - Teacher enters exam out of `60`
  - System converts it into the `40`-point exam contribution

### Legacy default weighting

- `CA1` max: `20`
- `CA2` max: `20`
- `CA3` max: `20`
- Exam contribution max: `40`
- Total max: `100`

## Calculation Rules

### CA Rules

- `caTotal = ca1 + ca2 + ca3`

### Exam Rules

- If `examInputMode = raw40`:
  - `examScaledScore = examRawScore`
- If `examInputMode = raw60_scaled_to_40`:
  - `examScaledScore = round((examRawScore / 60) * 40, 2)`

### Total Rule

- `total = round(ca1 + ca2 + ca3 + examScaledScore, 2)`

### Grade And Remark Rule

- Find the active grading band whose `minScore <= total <= maxScore`
- Set:
  - `gradeLetter = band.gradeLetter`
  - `remark = band.remark`

## Validation Rules

### Score Validation

- `ca1`, `ca2`, and `ca3` must be between `0` and `20`
- If exam mode is `raw40`, `examRawScore` must be between `0` and `40`
- If exam mode is `raw60_scaled_to_40`, `examRawScore` must be between `0` and `60`
- Empty rows may remain unsaved until the user provides valid numeric input

### Grading Band Validation

- Bands must be school-scoped
- Bands must not overlap
- Bands must cover `0` to `100`
- `minScore` must be less than or equal to `maxScore`
- Each active total must map to exactly one band

### Access Validation

- Every query and mutation must be filtered by `schoolId`
- Teachers may only open assigned class-subject sheets
- Admins may edit any class-subject sheet inside their school

## Data Model

### `schoolAssessmentSettings`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `examInputMode` | `"raw40" \| "raw60_scaled_to_40"` | Active school rule |
| `ca1Max` | number | Default `20` |
| `ca2Max` | number | Default `20` |
| `ca3Max` | number | Default `20` |
| `examContributionMax` | number | Default `40` |
| `isActive` | boolean | Single active record for v1 |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | User id |

### `gradingBands`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `minScore` | number | Lower inclusive bound |
| `maxScore` | number | Upper inclusive bound |
| `gradeLetter` | string | Example: `A`, `B`, `C` |
| `remark` | string | Example: `Excellent`, `Very Good` |
| `isActive` | boolean | Active for current rule set |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | User id |

### `assessmentRecords`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `sessionId` | id | Academic session |
| `termId` | id | Academic term |
| `classId` | id | Selected class |
| `subjectId` | id | Selected subject |
| `studentId` | id | Student on roster |
| `ca1` | number | Raw score out of `20` |
| `ca2` | number | Raw score out of `20` |
| `ca3` | number | Raw score out of `20` |
| `examRawScore` | number | Raw entered exam score |
| `examScaledScore` | number | Final exam contribution out of `40` |
| `total` | number | Final total out of `100` |
| `gradeLetter` | string | Derived from grading band |
| `remark` | string | Derived from grading band |
| `examInputModeSnapshot` | string | Snapshot of school mode at save time |
| `examRawMaxSnapshot` | number | `40` or `60` at save time |
| `status` | `"draft"` | Forward-compatible placeholder |
| `enteredBy` | id | User that first created the row |
| `updatedBy` | id | User that last updated the row |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |

## Query And Mutation Shape

### Queries

- `getSchoolAssessmentSettings`
- `getActiveGradingBands`
- `getExamEntrySheet`
  - inputs: `sessionId`, `termId`, `classId`, `subjectId`
  - returns:
    - roster rows
    - existing scores
    - school settings
    - active grading bands

### Mutations

- `saveSchoolAssessmentSettings`
- `saveGradingBands`
- `upsertAssessmentRecordsBulk`

## Permissions

### Teacher Rules

- Must be authenticated
- Must belong to the selected school
- Must be assigned to the selected class-subject pair
- Cannot modify school settings or grading bands

### Admin Rules

- Must be authenticated
- Must belong to the selected school
- May edit any exam-entry sheet in the same school
- May manage school settings and grading bands

## Live Auth Integration

- In live mode, the admin and teacher apps proxy Better Auth requests through local `/api/auth` routes to the Convex deployment.
- Convex resolves authenticated identities through Better Auth's Convex provider, so `ctx.auth.getUserIdentity()` is available to the exam-recording backend.
- Membership and role resolution continues through the app `users` table using `users.authId`.
- Preview mode remains available when `NEXT_PUBLIC_CONVEX_URL` is not configured, so the UI can still be exercised before full Convex wiring is finished.

## Live Seed Data

- Live testing uses the operator-gated Convex action at `functions/academic/seedRunner:seedDemoSchool` (the old `seedExamRecordingData` export is only a deprecated alias).
- The demo action is first-run-only on an explicitly selected, empty, disposable development deployment. Populated reset and production use are disabled. The confirmation phrase remains `RESET demo-school`, but it does not authorize deletion.
- Follow the [demo-school operator runbook](DemoSchoolOperatorRunbook.md) for the CLI selector, server operator gate, matching app URLs, and preflight. Any existing school, demo credential, or pending cleanup blocks the first run.
- Better Auth and Convex seed writes are separate transactions. If the first run is interrupted, abandon and replace the disposable dev deployment. Do not retry blindly or reset shared dev. A successful first run populates academics, families, reports, billing, events, knowledge, and stored profile artwork.
- Demo credentials are:
  - Admin: `admin@demo-academy.school` / `Admin123!Pass`
  - Teacher: `teacher@demo-academy.school` / `Teacher123!Pass`
  - Parent portal: `parent@demo-academy.school` / `Portal123!Pass`
- See `packages/convex/README.md` for the complete invocation, deployment safeguards, and dataset contents.

## Live Verification Script

- The first authenticated live smoke pass is automated in `scripts/test_live_exam_recording.py`.
- It verifies:
  - admin settings save
  - admin grading-band save
  - admin score-entry save
  - teacher score-entry save
- It restores changed demo values after each save. That is not a replacement for the first-run seed and does not make an interrupted seed safe to retry.

## Audit Fields

The feature should be audit-ready even before full moderation exists.

- Store `enteredBy` on first insert
- Update `updatedBy` and `updatedAt` on every save
- Preserve raw exam input and scaled exam contribution
- Preserve assessment-setting snapshots used when the row was saved

## UI Notes

### Teacher Entry Screen

- Mobile-first layout
- Fast roster scanning
- Sticky student identity column on larger screens
- Inline validation for out-of-range values
- Read-only display of:
  - exam mode
  - scaled exam contribution when school mode is `/60`
  - computed total
  - derived grade
  - derived remark

### Admin Screens

- Clear plain-language explanation of school exam mode
- Simple grading-band editor with overlap detection
- Same bulk grid behavior as teacher app, with broader access

## Future-Ready Notes

### Moderation

The `status` field is intentionally fixed to `"draft"` in v1 so a future moderation workflow can introduce:

- `submitted`
- `approved`
- `published`

without changing the base assessment record shape.

### Student-By-Student Entry

This v1 stores scores per `studentId + classId + subjectId + termId + sessionId`, so a future student-by-student entry view can reuse the same records without schema changes.

### Regrading

The historical v1 recommendation was to introduce a separate regrade tool rather than silently changing stored derived values. The current session-scoped flow implements a guarded scan and batched regrade, with audit history and issued-report payload preservation. See the section above.

## Acceptance Criteria

- Teachers can open a bulk exam-entry sheet for an assigned class-subject within their school.
- Admins can open a bulk exam-entry sheet for any class-subject within their school.
- Users can enter `CA1`, `CA2`, `CA3`, and `Exam` values in one roster grid.
- Legacy sessions use the school exam input modes `raw40` or `raw60_scaled_to_40` as fallback behavior where applicable. Explicit session policies allow editable raw and contribution maxima.
- The system computes `total`, `gradeLetter`, and `remark` automatically.
- Admins can manage school grading bands.
- Invalid score ranges and invalid grading bands are blocked with clear validation.
- All reads and writes remain scoped to one school.

## Verification Status

Verified on `2026-03-27` against the current repo state.

- Typecheck: PASS
- Lint: PASS
- Build: PASS
- Shared exam-recording tests: PASS
- Convex academic tests: PASS
- Workspace tests: PASS
- Live admin and teacher smoke tests: previously passed in `T14` and were not rerun in this follow-up verification pass

Implementation notes confirmed during verification:

- The school-wide exam input mode supports both `raw40` and `raw60_scaled_to_40`.
- The `/60 -> /40` conversion is documented and enforced for primary-school flows.
- Moderation, ranking, CGPA, and report-card generation remain out of scope for this v1 slice.
