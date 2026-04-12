# Configurable Report Card Add-Ons And Student-First Onboarding

## Goal
Give each school a global way to define reusable report-card add-on bundles, attach those bundles to any number of classes, and let the right staff enter the resulting fields without crowding the existing exam or enrollment screens.

This feature also adds a dedicated student-first onboarding route so new student intake can start on a student page, capture identity and guardian details cleanly, and then assign the student to a class as the final step. The current class-first `/academic/students` flow stays in place beside it.

## Components: Client vs Server

### Client

- `apps/admin/app/assessments/setup/report-card-bundles/page.tsx`
- `apps/admin/app/assessments/report-card-extras/page.tsx`
- `apps/teacher/app/assessments/report-card-workbench/page.tsx`
- `apps/teacher/app/assessments/report-card-extras/page.tsx` as a compatibility redirect to the workbench
- `apps/admin/app/academic/students/onboarding/page.tsx`
- existing report-card pages in admin and teacher apps so extras render in the same printable view:
  - `apps/admin/app/assessments/report-cards/page.tsx`
  - `apps/teacher/app/assessments/report-cards/page.tsx`

### Server

- `packages/convex/functions/academic/reportCardExtras.ts` for bundle, scale, assignment, and entry operations
- `packages/convex/functions/academic/reportCardExtrasModel.ts` for normalization, validation, and printable extras composition
- `packages/convex/functions/academic/reportCards.ts` for composing extras into printable report-card payloads
- `packages/convex/functions/academic/studentEnrollment.ts` for the student-first onboarding create flow and compatibility name handling
- `packages/convex/functions/academic/studentNameCompat.ts` for safe display-name compatibility and split-name backfill behavior
- `packages/convex/functions/academic/academicSetup.ts` if class-level level labeling needs a small Nursery-aware update

## Data Flow

### 1. Admin builds reusable add-on bundles

1. Admin opens the bundle builder route.
2. Admin creates a bundle with one or more sections.
3. Each section contains one or more fields.
4. Fields can use reusable rating scales or standard input types such as number, short text, long text, and single select.
5. Admin saves the bundle and assigns it to one or more classes.
6. The assignment is class-based, not level-precedence-based. A class can have zero, one, or many bundles.

### 2. Teacher enters class extras

1. Teacher opens the report-card workbench for a session, term, class, and student.
2. The server loads only bundles assigned to the selected class.
3. The UI renders the configured sections in a clean, read-only-from-schema layout.
4. If the teacher is the class form teacher, the fields are editable.
5. If the user is an admin, the same workspace acts as an override path.
6. When the user saves, Convex stores the values per school, session, term, class, student, bundle, and field.

### 3. Report cards include the extras

1. `getStudentReportCard` and `getClassReportCards` merge the core grade data with any saved add-on values.
2. The report-card sheet renders extras below the existing academic section blocks.
3. Full-class print uses the same hydrated payload, so printed sheets stay consistent with the on-screen report card.
4. If a class has no bundles, the report card still renders normally and simply shows no extra sections.

### 4. Student-first onboarding creates the student in the right order

1. Admin opens the student-first onboarding route.
2. Admin enters the student identity fields first, including first name, last name, admission number, and supporting bio data.
3. Admin enters guardian and contact details on the same flow without crowding the class roster page.
4. Admin can optionally link the first parent contact immediately and optionally provision temporary portal access for the student and parent during intake.
5. Admin selects the class as the final placement step.
6. The server creates or updates the linked `users` row and the `students` row using the same school-scoped rules as the current onboarding flow.
7. Existing records with only a display name are backfilled automatically where possible, and ambiguous names remain editable rather than blocking the flow.

## Database Schema

### Existing tables that remain in use

- `users`
  - add optional `firstName` and `lastName`
  - keep `name` as the compatibility display field used by current screens, search, and reports
- `students`
  - continues to store class placement and student profile data
- `classes`
  - keeps the current level and class identity model

### New tables

- `reportCardExtraScaleTemplates`
  - `schoolId`
  - `name`
  - `description?`
  - `options`
    - ordered reusable scale entries such as `A`, `B`, `C`, `D`, `E`
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
- `reportCardExtraBundles`
  - `schoolId`
  - `name`
  - `description?`
  - `sections`
    - each section contains ordered fields
    - each field stores `id`, `label`, `type`, `printable`, `order`, and optional `scaleTemplateId`
  - `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
- `reportCardExtraClassAssignments`
  - `schoolId`
  - `classId`
  - `bundleId`
  - `order`
  - `createdAt`, `assignedBy`, `updatedAt`, `updatedBy`
- `reportCardExtraStudentValues`
  - `schoolId`
  - `classId`
  - `studentId`
  - `sessionId`
  - `termId`
  - `bundleId`
  - `values`
    - ordered field-value payloads keyed by `fieldId`
  - `createdAt`, `updatedAt`, `updatedBy`

### Indexing expectations

- All new tables are school-scoped.
- Bundle and scale setup reads are indexed by school.
- Class assignment reads are indexed by class.
- Entry reads are indexed by `studentId + sessionId + termId` and by `classId + sessionId + termId` for report-card composition.

## Permissions

- Admin
  - can create, edit, archive, and assign bundles and scales
  - can edit extras for any class in the school
  - can add or update the head-teacher comment from the teacher workbench when signed into the teacher workspace as an admin
  - can use the student-first onboarding route
  - can override field values even when the class form teacher is unavailable
- Form teacher
  - can view and edit extras only for the class they are the form teacher of
  - can save values only for bundles assigned to that class
- Other teachers
  - can view the report-card output
  - cannot edit extras unless they are the form teacher or an admin
- School boundary
  - all bundle, assignment, and entry data stays within one school
  - cross-school class attachment is rejected

## UX Flows

### Bundle builder

- Admin starts on the bundle builder route.
- The route is discoverable from the admin workspace navigation as `Bundle Setup`.
- Admin adds sections, then fields inside each section.
- Admin chooses a reusable scale when a field needs an A-to-E style rubric.
- Admin reorders sections and fields before saving.
- Admin assigns the bundle to one or more classes from the same screen or a nearby assignment panel.
- A class can accumulate multiple bundles, so assignment is additive rather than single-select.
- The preview shows how the bundle will look on a report card before teachers ever use it.

### Teacher extras entry

- Teacher opens the workbench route, chooses session, term, class, and student, and sees only the bundles tied to that class.
- The existing teacher workbench remains the single editing surface for comments, subject selection, and report extras instead of splitting that work across multiple pages.
- When the signed-in user is an admin inside the teacher workspace, the same workbench also exposes the head-teacher comment editor for that selected student and class context.
- Editable fields appear only when the user has permission for that class.
- When several bundles are assigned to the class, the workspace renders each bundle and its sections in order.
- Save feedback should be compact and immediate.

### Student-first onboarding

- Admin opens `/academic/students/onboarding` to start from the student, not the class.
- Step one captures the student name split into first and last name plus admission number.
- Step two captures guardian name, phone, address, house, gender, date of birth, and optional photo.
- Step three can link the first parent contact and optionally prepare temporary portal credentials during intake.
- Step four selects the class and finishes creation.
- The existing `/academic/students` page keeps the class-first matrix and editing tools for roster work.

### Report-card rendering

- The report-card sheet shows configured extras in a stable order under the academic summary.
- Full-class print uses the same extras payload as the single-student view.
- If no bundles exist for a class, the UI falls back cleanly to the current report-card layout.

## Regression Checks

- Existing `/academic/students` class-first enrollment still works.
- Existing student profile editing still works and now exposes first and last names alongside the compatibility display name.
- Existing exam recording and report-card print flows still work when no bundles are configured.
- Teacher report-card access still respects school and class boundaries.
- Existing students with only `users.name` still render correctly before the name backfill is complete.
- Duplicate admission-number protection still applies in the new onboarding route.
- Parent email validation rejects malformed addresses before family links or portal credentials are created.
- Nursery appears where class-level selection and bundle assignment need it, without breaking Primary and Secondary screens.

## Explicit Out Of Scope

- formulas or computed fields inside bundles
- conditional show/hide logic
- portal-facing extras entry or display
- replacing the current class-first `/academic/students` flow
- bulk CSV import for onboarding
- level-precedence assignment rules between level and class
- student self-service editing of add-on data

## Approval Gate

This document is the blueprint for the feature slice.

Implementation does not start until the user approves this spec.

After approval, the work splits into backend domain/schema, admin bundle UI, report-card extras integration, student-first onboarding UI, and final integration/docs sync tasks.
