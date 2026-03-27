# Student Enrollment Profile Capture

## Goal
Allow admins to capture more student profile details at the moment a student is created, so they do not need to immediately reopen the student profile editor just to fill in common onboarding information.

## Components

### Client
- `apps/admin/app/academic/students/page.tsx`
- `apps/admin/app/academic/students/components/StudentCreationForm.tsx`
- `apps/admin/app/academic/students/components/FloatingNotice.tsx`
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`
- `apps/admin/app/academic/students/components/StudentProfileFormFields.tsx`

### Server
- `packages/convex/functions/academic/studentEnrollment.ts`

## Data Flow
1. Admin opens the add-student form from the desktop page or the mobile sheet.
2. Admin enters required fields:
   - student name
   - admission number
   - gender
3. Admin may optionally fill:
   - house
   - date of birth
   - guardian name
   - guardian phone
   - address
   - student photo
4. If a photo is selected, the client validates that it is an image no larger than 1 MB, uploads it to storage, and includes the returned metadata in the create payload.
5. Client submits the full payload to `createStudent`.
6. Convex creates the linked `users` row and the `students` row with any provided optional profile data.
7. After save, the UI shows:
   - success if the profile is sufficiently complete
   - warning if the student was saved but some optional onboarding fields were skipped

## Database Schema

### Existing tables used
- `users`
  - stores the student identity record
- `students`
  - now captures initial optional onboarding fields during creation

### Fields used on create
- `admissionNumber`
- `houseName`
- `gender`
- `dateOfBirth`
- `guardianName`
- `guardianPhone`
- `address`
- `photoStorageId`
- `photoFileName`
- `photoContentType`

### Schema changes
- None planned

## UX Direction
- Keep the form fast for compulsory data
- Treat `gender` as required so admins do not have to fill it twice
- Keep the other profile fields optional
- Allow an optional report-card photo during creation, but reject files larger than 1 MB immediately
- After save, give a short warning that names the missing optional fields instead of blocking the workflow

## Regression Checks
- Existing student creation still works with required fields
- Duplicate admission-number protection still applies
- Newly created students still appear in the subject workflow immediately
- Admin mobile add-student sheet still works
- Student photos can now be uploaded during creation with the same image-only rules used by the profile editor
- Editing a student profile later still works with the same field set

## Implemented Outcome
- Student creation now captures `gender` up front as a required field.
- Admins can optionally fill house, date of birth, guardian name, guardian phone, and address during creation.
- Admins can also attach an optional student photo during creation, with a 1 MB file-size limit enforced before upload.
- If optional details like house, guardian fields, address, or photo are skipped, save still succeeds and the UI shows a warning-style reminder listing the missing fields.
- The same standardized gender choices now appear in the full profile editor.
