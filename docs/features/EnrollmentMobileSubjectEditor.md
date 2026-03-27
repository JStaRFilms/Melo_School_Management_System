# Enrollment Mobile Subject Editor

## Goal
Make subject selection genuinely usable on small phones for both admin and teacher routes by replacing the cramped horizontal matrix with a mobile-first student card flow, while preserving the current desktop matrix for larger screens.

## Components

### Client
- `apps/admin/app/academic/students/page.tsx`
- `apps/admin/app/academic/students/components/SubjectSelectionMatrix.tsx`
- `apps/admin/app/academic/students/components/StudentCreationForm.tsx`
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
- `apps/teacher/app/enrollment/subjects/page.tsx`
- `apps/teacher/app/enrollment/subjects/components/SubjectSelectionMatrix.tsx`
- New shared route-local mobile components:
  - `StudentSubjectMobileList`
  - `StudentSubjectMobileCard`
  - `StudentSubjectEditorSheet`
- Admin-only mobile roster components:
  - `AdminMobileRosterActions`
  - `MobileSheet`
- Shared responsive behavior:
  - desktop and tablet keep the existing matrix
  - small screens switch to a stacked card list with a dedicated subject editor surface

### Server
- Reuse existing Convex query:
  - `functions/academic/studentEnrollment:getClassStudentSubjectMatrix`
- Reuse existing Convex mutation:
  - `functions/academic/studentEnrollment:setStudentSubjectSelections`
- No backend contract changes planned

## Data Flow
1. User opens the class subject selection route.
2. The client loads the same class/session/student/subject matrix data already used by the desktop table.
3. On mobile, the page renders one student card per row instead of a wide subject table.
4. The user taps a student card or `Edit Subjects` action.
5. A mobile editor sheet opens with:
   - student identity
   - selected count
   - `Select All` and `Clear All`
   - one large tap target per subject
6. The user toggles subjects from the sheet.
7. The client calls `setStudentSubjectSelections` immediately after each change, matching the current live-save model.
8. The list updates the student summary count and completion state without requiring horizontal scrolling.
9. On admin mobile, add-student and full-profile editing open in sheets instead of forcing the user to scroll to separate sections lower on the page.

## Database Schema

### Existing tables used
- `classes`
- `academicSessions`
- `students`
- `users`
- `subjects`
- `classSubjects`
- `studentSubjectSelections`
- `teacherAssignments`

### Schema changes
- None planned

## UX Direction

### Mobile layout
- Replace the small-screen matrix with vertically stacked student cards
- Show name, admission number, and selected-subject count up front
- Make the primary action `Edit Subjects`
- Keep `All` and `Clear` visible but secondary
- On admin, expose `Add Student` and `Edit Profile` as direct mobile actions

### Mobile editor sheet
- Open from the bottom as a full-height or near-full-height sheet
- Use large subject rows with clear checked states
- Keep the student name and quick actions pinned at the top
- Keep save model instant, with lightweight feedback
- On admin, allow the subject sheet to jump directly into the full profile sheet

### Desktop behavior
- Preserve the existing matrix layout on larger screens
- Avoid creating two separate data models or write paths

## Why This Direction
- Horizontal subject grids are efficient on desktop but frustrating on narrow screens
- A student-first mobile flow matches how admins and teachers think on the move: pick a student, adjust subjects, move to the next student
- The same mutation flow means low backend risk and easier regression testing

## Regression Checks
- Admin can still add students from the same route
- Admin and teacher can still update subject selections with instant save
- Teacher still cannot perform roster-only admin actions
- Class and session switching still reload the correct data
- Desktop matrix behavior remains intact on larger breakpoints

## Approval Notes
- Recommended direction: responsive split UI
  - mobile: student cards + editor sheet
  - desktop: existing matrix
- This keeps the fast matrix where it works and introduces a phone-friendly workflow where it currently struggles

## Implemented Outcome
- Admin and teacher routes now switch to stacked student cards on small screens.
- Each mobile student card shows identity and selected-subject count before editing.
- Subject editing on phones now happens inside a bottom sheet with larger tap targets.
- `Select All` and `Clear All` moved into the mobile editor sheet where they support the "select all, then trim down" workflow cleanly.
- Desktop and tablet screens still use the existing matrix pattern.
- Admin mobile now has roster-action sheets for `Add Student` and `Edit Student Profile`, so the user does not need to scroll away from the subject workflow to manage student details.
- The add-student flow now supports initial profile capture with required gender, optional guardian or demographic fields, and an optional student photo capped at 1 MB, plus a saved-with-reminders warning when optional details are skipped.

## Verification Notes
- The responsive split lives entirely in the client UI layer and reuses the existing enrollment query and mutation.
- Full repo typecheck is still blocked by pre-existing alias-resolution issues outside this feature area, so verification focuses on the touched enrollment components.
