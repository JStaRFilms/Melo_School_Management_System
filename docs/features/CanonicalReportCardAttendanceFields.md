# Canonical Report Card Attendance Fields

## Goal
Keep report-card bundles configurable per school while introducing canonical field ownership for attendance-related extras so schools can decide what appears on the report card without letting teachers manually override admin-owned values.

This change removes duplicated `Next term begins` output from the extras area, preserves the existing term-level field at the top of the report card, and introduces a clean split between teacher-entered extras, admin-entered extras, and derived attendance values.

## Components: Client vs Server

### Client

- `apps/admin/app/assessments/setup/report-card-bundles/components/BundleEditor.tsx`
- `apps/admin/app/assessments/setup/report-card-bundles/types.ts`
- `apps/admin/app/assessments/report-card-extras/components/ExtrasWorkspace.tsx`
- `apps/admin/app/assessments/report-card-extras/components/types.ts`
- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
- teacher report-card extras workspace components that consume the same Convex payload

### Server

- `packages/convex/schema.ts`
- `packages/convex/functions/academic/reportCardExtrasModel.ts`
- `packages/convex/functions/academic/reportCardExtras.ts`
- `packages/convex/functions/academic/reportCards.ts`

## Data Flow

### 1. Admin defines field source during bundle setup

1. Admin creates or edits a report-card bundle.
2. Each field still defines label, type, scale, and print visibility.
3. Each field now also defines a source:
   - `teacher_manual`
   - `admin_manual`
   - `system_term`
   - `system_attendance`
4. Canonical fields such as attendance values use locked system-backed sources instead of free teacher input.

### 2. Admin or teacher enters only the values they own

1. The extras workspace loads bundle definitions and the selected student context.
2. The server resolves each field into a final editor state.
3. Teacher-owned fields stay editable for form teachers.
4. Admin-owned fields are editable only for admin overrides.
5. System-backed fields render as read-only computed values.

### 3. Report card composition uses canonical values

1. `Next term begins` keeps using the existing term-level field and remains visible only in the report-card header.
2. Attendance fields pull from report-card attendance values instead of teacher-entered bundle values.
3. Derived fields such as absences are calculated from canonical counts.
4. The printable extras section skips duplicate `Next term begins` fields.

## Database Schema

### Existing tables updated

- `reportCardExtraBundles`
  - field definitions gain `source`
  - field definitions can optionally carry a `systemKey` for canonical fields
- `reportCardExtraStudentValues`
  - remains the storage layer for manual per-student values
  - stores only teacher/admin manual values

### New table

- `reportCardAttendanceValues`
  - `schoolId`
  - `classId`
  - `studentId`
  - `sessionId`
  - `termId`
  - `timesSchoolOpened?`
  - `timesPresent?`
  - `attendanceCode?`
  - `createdAt`
  - `updatedAt`
  - `updatedBy`

### Derived values

- `timesAbsent`
  - computed as `timesSchoolOpened - timesPresent` when both values are available
- `nextTermBegins`
  - continues to come from `academicTerms.nextTermBegins`

## Permissions

- Admin
  - can configure all field sources
  - can enter admin-owned attendance values
  - can override teacher-owned extras
- Form teacher
  - can edit only `teacher_manual` fields
  - cannot edit admin-owned attendance values
  - can see read-only canonical attendance values on the workspace
- Other teachers
  - no edit access

## UX Rules

- `Next term begins` must never appear twice on the same report card.
- Canonical attendance fields should look intentional, not like disabled broken inputs.
- If a school wants attendance on the report card, they enable the configured fields in the bundle, but the source of truth remains system-owned.
- If canonical attendance data is missing, show a clear empty state such as `Not set`.

## Regression Checks

- Existing term-level `Next term begins` save flow still works.
- Existing teacher-entered bundle fields still save correctly.
- Existing bundles without source metadata fall back safely to teacher-manual behavior unless mapped to a canonical system key during normalization.
- Full report-card printing and class batch printing still render extras consistently.

## Explicit Out Of Scope

- daily attendance register implementation
- auto-computing attendance from a full attendance module
- portal-side attendance editing
- removing the bundle system

## Implementation Notes

- Backward compatibility matters because existing bundles and saved values already exist.
- Canonical label matching should be conservative and limited to attendance fields and duplicate `Next term begins`.
- Admin attendance storage should be independent of teacher extra-value storage to preserve ownership boundaries.

## Implementation Status

- Added bundle field ownership metadata with canonical field selection in the bundle setup UI.
- Added canonical attendance storage tables in Convex for class-wide and student-specific values.
- Updated extras composition so `Next term begins` stays in the report-card header and is no longer repeated in printable extras.
- Updated admin and teacher extras workspaces so canonical values render as admin-managed or calculated fields instead of teacher-editable extras.
