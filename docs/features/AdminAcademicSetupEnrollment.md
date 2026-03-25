# Admin Academic Setup & Enrollment

## Goal
Provide a streamlined, mobile-first workflow for school administrators to configure the academic foundation of their school (teachers, sessions, terms, subjects, and classes) and manage student enrollment and subject selection.

## Overview
This feature allows administrators to:
1.  **Define the Academic Calendar**: Create sessions (e.g., 2025/2026) and terms.
2.  **Manage the Staff**: Create and list teachers with real Better Auth-backed accounts.
3.  **Build the Catalog**: Define the list of subjects offered by the school.
4.  **Structure the School**: Create classes, assign form teachers, and define subject offerings.
5.  **Assign Teaching Access**: Map teachers to class subjects so assigned teachers can later edit student subject selections.
6.  **Enroll Students**: Add students to classes using the shared school user model.
7.  **Select Student Subjects**: Map students to specific subjects within their class (matrix view).

## In Scope
- Teacher creation and listing (Admin)
- Session and Term management (Admin)
- Subject catalog management (Admin)
- Class creation, form-teacher assignment, and subject offering selection (Admin)
- Subject-teacher assignment for class access (Admin)
- Student roster management (Admin adds students to classes)
- Student subject enrollment matrix (Admin/Teacher)
- Permission split:
    - Admin: Full control over all setup.
    - Teacher: Can view their classes and edit subject selections for students already in their class (but cannot add/remove students from the school/class).

## Out Of Scope
- Parent onboarding and portal
- Bulk CSV import (manual entry focus for v1)
- Advanced admissions workflows
- Promotion/Demotion between sessions

## User Roles

### School Admin
- Full access to all setup screens.
- Can create any entity and modify any relationship.

### Teacher
- Can view classes they are assigned to.
- Can edit subject selections for students in their assigned classes (e.g., checking/unchecking "Further Maths" for a specific student).
- Cannot create new classes, subjects, or students.

## Implemented Routes

### Admin
- `apps/admin/app/academic/teachers/page.tsx`
- `apps/admin/app/academic/sessions/page.tsx`
- `apps/admin/app/academic/subjects/page.tsx`
- `apps/admin/app/academic/classes/page.tsx`
- `apps/admin/app/academic/students/page.tsx`

### Teacher
- `apps/teacher/app/enrollment/subjects/page.tsx`

## Data Model (Conceptual)

### `academicSessions`
- `name` (e.g., "2025/2026")
- `isActive` (boolean)
- `startDate`, `endDate`

### `academicTerms`
- `sessionId` (reference)
- `name` (e.g., "First Term")
- `isActive` (boolean)

### `users`
- shared table for school admins, teachers, and students
- teacher accounts are provisioned through Better Auth and then inserted as school-scoped `users`
- student records also link back to a dedicated school-scoped `users` row

### `subjects` (Catalog)
- `name` (e.g., "Mathematics")
- `code` (e.g., "MAT101")

### `classes`
- `name` (e.g., "Primary 4A")
- `level` (Primary/Secondary)
- `formTeacherId` (reference to teacher)

### `classSubjects` (Offering)
- `classId`
- `subjectId`
- `teacherId` (Subject teacher)

### `students`
- `classId`
- `userId` (linked `users` row for the student identity)
- `admissionNumber`

### `studentSubjectSelections`
- `studentId`
- `classId`
- `subjectId`
- `sessionId`

## Implementation Notes

- Teacher creation is a real live action, not a fake local insert:
  - Better Auth account is created first
  - matching school-scoped `users` row is inserted after auth provisioning succeeds
- Student creation inserts both:
  - a linked `users` row with role `student`
  - a `students` row scoped to the selected class
- Class management now supports:
  - form-teacher assignment
  - subject offering selection
  - subject-teacher assignment for teacher access
- Teacher access to the enrollment matrix is enforced through class-subject assignments.
- The admin and teacher enrollment pages both use the same `studentSubjectSelections` model.

## UI/UX Direction
- **Mobile First**: All setup screens must be functional on a phone (one-handed operation).
- **Precision Academic Editorial**: Clean, high-density, no fluff.
- **Workflow-centric**: Fast "Add" buttons, clear lists, intuitive selectors.
- **Matrix Enrollment**: A dedicated view for checking off many subjects for many students efficiently.

## Definition of Done
- Mockups covering all screens in scope.
- Clear distinction between Admin and Teacher views.
- Understandable flow for school onboarding.
- Admin can create teachers, sessions, terms, subjects, classes, and students in the live app.
- Admin and assigned teachers can both update student subject selections using the same matrix model.
