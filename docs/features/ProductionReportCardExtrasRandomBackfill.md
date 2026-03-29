# Production Report Card Extras Random Backfill

## Goal
Populate production report-card extras for every active student in every class currently assigned the `Primary Conduct` bundle.

The backfill should:

- target the production Convex deployment only
- write random descriptor values for the psychomotor and affective-domain fields
- leave attendance fields untouched
- operate on the current active session and active term
- avoid changing unrelated report-card, grading, or attendance data

## Current Production Scope

- School: `kd73q7dt28ph1bmqjm20tsw2ed83k6j3`
- Active session: `j5703q16yfmbc9n2pwaa55ak6n83jkjw` (`2025/2026 Academic Session`)
- Active term: `j97f5va263919wyfg6rkadm6ys83jyzr` (`Second Term`)
- Bundle: `m176y5b5cyggbm1t8z0ez4hpbh83v5fw` (`Primary Conduct`)
- Assigned classes: `7`
- Active students in assigned classes: `41`
- Archived students in assigned classes: `4`
- Existing extras rows in production: `0`

## Components: Client vs Server

### Client

- No client changes required.

### Server

- one temporary Convex mutation or action to:
  - read bundle assignments in production
  - resolve active students in assigned classes
  - resolve allowed scale options from the configured template
  - generate random scale selections for teacher-managed extras only
  - insert `reportCardExtraStudentValues` rows per student and bundle
- optional temporary query or console summary to verify inserted row counts

## Data Flow

### 1. Discover target scope

1. Read the production `reportCardExtraClassAssignments` table.
2. Keep only assignments for the target school.
3. Resolve active students in those assigned classes.
4. Resolve the active session and active term for the same school.

### 2. Build random extras payloads

1. Read the assigned extras bundle definition from `reportCardExtraBundles`.
2. Keep only manual scale fields in:
   - `Psychomotor SKILL`
   - `Affective Domain`
3. Exclude all `system_attendance` fields from the generated payload.
4. For each student, choose random valid scale-option ids from the linked scale template.

### 3. Write production records

1. Create one `reportCardExtraStudentValues` row per student and bundle.
2. Set `schoolId`, `classId`, `studentId`, `sessionId`, `termId`, `bundleId`, and generated `values`.
3. Leave `reportCardAttendanceClassValues` unchanged.
4. Leave `reportCardAttendanceStudentValues` unchanged.

### 4. Verify results

1. Confirm row count matches the number of targeted active students.
2. Spot-check a few records to confirm only psychomotor and affective fields were written.
3. Confirm attendance tables remain unchanged.

## Database Schema

### Read From

- `reportCardExtraBundles`
- `reportCardExtraClassAssignments`
- `reportCardExtraScaleTemplates`
- `students`
- `classes`
- `academicSessions`
- `academicTerms`

### Write To

- `reportCardExtraStudentValues`

### Explicitly Do Not Write To

- `reportCardAttendanceClassValues`
- `reportCardAttendanceStudentValues`

## Randomization Rules

- Use only valid option ids from the bundle's linked scale template.
- Treat each field independently so values vary across students.
- Keep the script deterministic only in structure, not in outcome.
- Do not invent free-text descriptors outside the configured scale options.

## Safety Rules

- Production only, not development.
- Default scope is active students only.
- Archived students are excluded unless explicitly requested.
- Attendance stays untouched.
- If extras rows already exist for a targeted student and bundle at execution time, stop and report instead of blindly overwriting.

## Regression Checks

- Report-card extras render without changing attendance values.
- Existing report-card comments remain unchanged.
- Non-target schools remain untouched.
- Archived students remain untouched by default.

## Approval Gate

This document is the blueprint for the production backfill.

Implementation started after user approval.

## Implementation

The backfill was implemented as a temporary Convex mutation that:

1. validated the exact production school, active session, and active term
2. required an explicit confirmation phrase
3. refused to proceed if matching extras rows already existed
4. generated random scale-option values only for manual psychomotor and affective fields
5. skipped all attendance-backed fields

## Execution Outcome

- production deployment targeted: `outgoing-warbler-782`
- rows created in `reportCardExtraStudentValues`: `41`
- targeted classes: `7`
- targeted active students: `41`
- targeted bundle count: `1`
- existing matching extras rows before execution: `0`
- attendance class rows after execution: `2`
- attendance student rows after execution: `0`

## Follow-Up Correction

The first backfill used the full configured `A-E` descriptor scale:

- `A` -> `Excellent`
- `B` -> `Very Good`
- `C` -> `Good`
- `D` -> `Average`
- `E` -> `Poor`

That was broader than requested. The requested outcome is the `A/B/C` subset only.

### Correction Rules

- rewrite the same 41 production extras rows in place
- keep the same target school, session, term, classes, bundle, and active-student scope
- restrict all generated scale values to:
  - `excellent`
  - `very-good`
  - `good`
- exclude:
  - `average`
  - `poor`
- keep attendance untouched
- verify no corrected row contains `average` or `poor`

### Correction Outcome

- corrected rows in place: `41`
- allowed values after correction: `excellent`, `very-good`, `good`
- rows still containing `average` or `poor` after correction: `0`
- attendance class rows after correction: `2`
- attendance student rows after correction: `0`

## Cleanup

After execution and verification, the temporary Convex mutation is removed and the final production deploy is run so the one-off entrypoint does not remain exposed.

## Completed Work

The approved work was:

1. add a temporary production-safe Convex backfill function
2. run it against production
3. verify inserted counts and spot-check records
4. run `pnpm convex deploy` before handoff as required by the project instructions
