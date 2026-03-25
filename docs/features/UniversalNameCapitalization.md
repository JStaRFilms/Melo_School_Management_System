# Universal Name Capitalization

## Goal

Ensure every human-entered name in the app is normalized to title case, so names look consistent across forms, lists, selectors, rosters, report-style views, and backend records.

## Scope

Included:
- school names
- user names for admins, teachers, students, and parents
- class names
- subject names
- session names
- term names
- display surfaces that render any of the above values

Excluded:
- emails
- slugs
- admission numbers
- subject codes
- any identifier that is not a human name

## Components

### Client

- form inputs that capture human names
- shared input normalization helper
- UI preview/display formatting for name-bearing labels
- any inline validation or blur handler that keeps names normalized while typing

### Server

- Convex mutations that create or update name-bearing entities
- shared backend normalization helper used before persistence
- queries that should continue returning normalized values without extra client work

## Data Flow

1. User types a name into a form field.
2. The client normalizes the visible value to title case before submit and, where appropriate, while typing.
3. The submitted payload reaches the server with a normalized name value.
4. The server applies the same normalization before writing to the database to protect against direct API calls or stale clients.
5. Queries return already-normalized values, so every workspace displays names consistently.

## Database Schema

No new tables are required.

Name normalization applies to existing name-bearing fields, including:
- `schools.name`
- `users.name`
- `classes.name`
- `subjects.name`
- `academicSessions.name`
- `academicTerms.name`

## Implementation Notes

- Use one shared capitalization utility rather than repeating formatting logic per screen.
- Keep code and non-name fields unchanged.
- Apply the rule at both the client and server layers so the database remains the source of truth.
- Be careful not to alter technical fields such as codes, emails, slugs, or admission numbers.

## Implementation (Current)

Client-side normalization is applied on change and blur for name inputs, and applied again at submit boundaries:
- Shared formatter: `packages/shared/src/name-format.ts`
- Admin app helper: `apps/admin/lib/human-name.ts` (used via `@/human-name`)
- Teacher app helper: `apps/teacher/lib/human-name.ts` (used via `@/lib/human-name`)
- Typing helper: `humanNameTyping`
- Final helper: `humanNameFinal`

Updated name-entry routes:
- `apps/admin/app/academic/teachers/page.tsx`
- `apps/admin/app/academic/students/page.tsx`
- `apps/admin/app/academic/classes/page.tsx`
- `apps/admin/app/academic/subjects/page.tsx`
- `apps/admin/app/academic/sessions/page.tsx`

Updated name display for student roster surfaces:
- `apps/admin/app/assessments/results/entry/page.tsx`
- `apps/admin/app/assessments/results/entry/components/AdminRosterGrid.tsx`
- `apps/admin/app/assessments/results/entry/components/AdminRosterGridRow.tsx`
- `apps/teacher/app/enrollment/subjects/page.tsx`
- `apps/teacher/app/assessments/exams/entry/components/RosterGridRow.tsx`
- `apps/teacher/app/assessments/exams/entry/components/ExamEntryWorkspace.tsx`

## Definition Of Done

- every supported name field is stored in title case
- every supported name field renders in title case throughout the app
- direct server writes cannot bypass the capitalization rule
- non-name fields remain unchanged
