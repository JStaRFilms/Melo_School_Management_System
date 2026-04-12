# Parent and Family Linking Foundation

## Goal
Give school admins a lightweight way to create real household records, link parents or guardians to students, and keep that relationship available for later billing and portal work.

## Components

### Client
- `apps/admin/app/academic/students/components/StudentFamilyPanel.tsx`
- `apps/admin/app/academic/students/components/StudentProfileEditor.tsx`

### Server
- `packages/convex/functions/academic/studentEnrollment.ts`
- `packages/convex/schema.ts`

## Data Flow
1. An admin opens a student record in the roster editor.
2. The family panel loads the student’s household context, if one already exists.
3. The admin enters a parent first name, last name, and email address, with an optional phone number and relationship label.
4. When the admin saves the link:
   - the server creates or reuses a school-scoped parent identity row
   - parent reuse is keyed by normalized email address
   - the server creates or reuses a family record
   - the server attaches the parent to that family
   - the server marks the first or chosen contact as primary when requested
5. From the student screen, the safe removal action is now to unlink the current student from the household. Parent removal is treated as a household-wide operation and is not performed from the student-scoped editor.

## Database Schema

### `families`
- school-scoped household record
- stable anchor for future billing and portal grouping

### `familyMembers`
- links a parent identity to a family
- stores relationship label and primary-contact status

### `students`
- now includes optional `familyId` so one student can point at the active household record

### `users`
- parent identity rows now carry optional phone numbers
- parent rows can be created by admin workflow before the portal exists

## UX Direction
- Keep the flow fast enough to use from the student profile drawer
- Let admins create a new household without switching screens
- Make it obvious when a parent is the primary contact
- Keep the panel readable on small screens so it fits the existing mobile roster workflow
- Avoid household-wide destructive actions from a student-scoped editor

## Regression Checks
- Existing student profile editing still works
- Student academic enrollment still works even when no family is linked yet
- A student can be linked to one or more parent contacts
- Unlinking a student from a family does not orphan the household record
- Re-linking the same parent reuses the normalized-email parent identity and, where possible, reuses a matching orphan household instead of creating a duplicate
- Parent contact rows are reusable for future portal or billing work

## Implemented Outcome
- Admins can create or link parent contacts from the student profile editor.
- A family record is created automatically when the first parent is linked.
- Student records now carry an optional family anchor for later billing use.
- The admin roster now exposes a real household foundation without implementing the parent portal surface yet.
