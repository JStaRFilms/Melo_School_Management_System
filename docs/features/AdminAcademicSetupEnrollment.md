# Admin Academic Setup & Enrollment

## Goal
Provide a streamlined, mobile-first workflow for school administrators to configure the academic foundation of their school (teachers, sessions, terms, subjects, and classes) and manage student enrollment and subject selection.

## Overview
This feature allows administrators to:
1.  **Define the Academic Calendar**: Create sessions (e.g., 2025/2026) and terms.
2.  **Manage the Staff**: Create and list teachers.
3.  **Build the Catalog**: Define the list of subjects offered by the school.
4.  **Structure the School**: Create classes and assign teacher leads.
5.  **Configure Class Offerings**: Decide which subjects are taught in which class.
6.  **Enroll Students**: Add students to classes for a specific session.
7.  **Select Student Subjects**: Map students to specific subjects within their class (matrix view).

## In Scope
- Teacher creation and listing (Admin)
- Session and Term management (Admin)
- Subject catalog management (Admin)
- Class creation and subject offering selection (Admin)
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

## Data Model (Conceptual)

### `academicSessions`
- `name` (e.g., "2025/2026")
- `isActive` (boolean)
- `startDate`, `endDate`

### `academicTerms`
- `sessionId` (reference)
- `name` (e.g., "First Term")
- `isActive` (boolean)

### `teachers`
- `name`, `email`, `phone`
- `authUserId` (linked better-auth user)

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
- `name`, `registrationNumber`
- `gender`, `dob`

### `enrollments`
- `studentId`
- `classId`
- `sessionId`

### `studentSubjectSelections`
- `studentId`
- `classId`
- `subjectId`
- `sessionId`

## UI/UX Direction
- **Mobile First**: All setup screens must be functional on a phone (one-handed operation).
- **Precision Academic Editorial**: Clean, high-density, no fluff.
- **Workflow-centric**: Fast "Add" buttons, clear lists, intuitive selectors.
- **Matrix Enrollment**: A dedicated view for checking off many subjects for many students efficiently.

## Definition of Done
- Mockups covering all screens in scope.
- Clear distinction between Admin and Teacher views.
- Understandable flow for school onboarding.
