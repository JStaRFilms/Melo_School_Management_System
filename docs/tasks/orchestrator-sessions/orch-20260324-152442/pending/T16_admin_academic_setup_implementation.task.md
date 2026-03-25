# T16 Admin Academic Setup and Enrollment Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, `convex-functions`, `convex-schema-validator`, `convex-best-practices`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the academic setup and student subject enrollment feature so a real school admin can create teachers, subjects, classes, students, and subject selections, while assigned teachers can later edit subject selections for students in their class.

## Scope

Included:
- schema updates required for class subject offerings and student subject enrollments
- admin-only backend queries and mutations
- teacher-authorized subject-enrollment editing for assigned classes
- admin UI implementation for:
  - teacher creation
  - session and term creation/management
  - subject catalog
  - class creation
  - class subject offering selection
  - student roster creation
  - student subject enrollment checkbox matrix
- teacher UI implementation for editing subject selections of existing class students
- typecheck/tests for the new slice

Excluded:
- full parent onboarding
- spreadsheet import
- teacher assignment UX beyond what is required by this slice
- portal/student-facing views

## Context

Use:
- `docs/project_requirements.md`
- `docs/features/AdminAcademicSetupEnrollment.md`
- approved `T15` mockups once available
- current admin auth + Convex live setup from `T11` through `T14`

## Definition Of Done

- an admin can create a teacher account scoped to their school
- an admin can create a session and define terms for it
- an admin can create and manage school subjects
- an admin can create a class and choose its offered subjects
- an admin can add students into a class
- an admin can tick which offered subjects each student takes
- a teacher assigned to that class can update those subject selections later
- a teacher cannot create a student
- all writes are school-scoped and role-protected

## Expected Artifacts

- backend schema/functions for the new slice
- admin app pages/components wired to live Convex
- tests and verification notes

## Constraints

- keep files modular and split early if they grow too large
- do not invent a second overlapping enrollment model
- integrate with the existing `users`, `students`, `classes`, and `subjects` tables
- keep the subject-selection UX bulk-friendly for real school setup
- use one shared enrollment model with role-based access, not separate admin and teacher copies

## Verification

- confirm teacher creation produces a usable `users` row with role `teacher`
- confirm session and term creation produce valid school-scoped academic records
- confirm class subject offerings persist correctly
- confirm student subject selections persist correctly and reject invalid class-subject combinations
- confirm assigned teachers can edit subject selections for their class
- confirm teachers cannot create students
- confirm typecheck and tests pass
