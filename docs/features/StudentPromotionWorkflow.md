# Student Promotion Workflow

## Goal
Allow school admins to promote selected active students from one class/session context to another without rewriting historical academic or billing records.

## Audit Outcome
Promotions were previously **partial**: admins could edit a student's active `classId` from the profile editor, but there was no bulk promotion workflow, no target-session subject enrollment, and no promotion audit row. Historical report-card reads could also mix same-session subject selections across old and new classes.

## Implemented Behavior
- Admins can select students from `/academic/students` and promote them to a target class and target session.
- The workflow updates only the student's current active class pointer.
- Historical records remain tied to their original context:
  - `studentSubjectSelections` for the old class/session are preserved.
  - `assessmentRecords` are not mutated.
  - `studentInvoices` and payment rows are not mutated.
  - `familyId`, family members, and parent links are not mutated.
- Archived students and archived linked student users are blocked from promotion.
- The target class and target session must belong to the same school and be active/non-archived.
- New subject enrollment can be created in the target class/session using one of three modes:
  - all active target-class subjects
  - only subjects that match the old source selection
  - no subject enrollment yet
- Each promoted student writes an auditable `studentPromotions` row with source/target class, source/target session, subject enrollment mode, subject count, batch key, timestamp, and actor.
- Report-card subject resolution now uses subject selections for the report-card class context only, preventing same-session old/new class selections from being combined.

## Safety Rules
- Promotion is admin-only.
- A promotion cannot target the exact same class and session as the source context.
- The mutation processes at most 100 selected students at a time.
- Existing target subject-selection rows are not duplicated.
- Old report cards and invoices are intentionally left unchanged.

## Verification Notes
- Student movement is school-scoped through Convex auth membership and source/target record ownership checks.
- Billing invoices remain tied to their saved `studentId`, `classId`, `sessionId`, and `termId` snapshots.
- Report cards continue to prefer saved `assessmentRecords.classId`; batch report cards pass the selected class as preferred context.
