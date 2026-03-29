# Grouped Report Card Term Settings

## Goal
Let admins set shared report-card term values once and reuse them across multiple classes, while still allowing teachers to enter per-student attendance presence values.

This change specifically covers:

- `Number of times opened`
  - admin-owned
  - shared by term default or class-group override
- `Number of times present`
  - teacher-entered per student
- `Number of times absent`
  - automatically calculated
- `Next term begins`
  - shared by term default or class-group override

## Components: Client vs Server

### Client

- `apps/admin/app/assessments/report-cards/components/ReportCardAdminPanel.tsx`
- `apps/admin/app/assessments/report-card-extras/components/ExtrasWorkspace.tsx`
- `apps/teacher/app/assessments/report-card-workbench/components/ExtrasSection.tsx`

### Server

- `packages/convex/schema.ts`
- `packages/convex/functions/academic/reportCardTermSettings.ts`
- `packages/convex/functions/academic/reportCards.ts`
- `packages/convex/functions/academic/reportCardExtras.ts`
- `packages/convex/functions/academic/reportCardExtrasModel.ts`

## Data Flow

### 1. Admin sets defaults once per term

1. Admin opens the report-card admin panel.
2. Admin sets:
   - default `next term begins`
   - default `number of times opened`
3. These defaults apply to every class in the term unless a class-group override exists.

### 2. Admin creates class groups for shared overrides

1. Admin creates a named group for the selected term.
2. Admin chooses multiple classes for that group.
3. Admin optionally overrides:
   - `next term begins`
   - `number of times opened`
4. A class can belong to only one group per term, so resolution stays deterministic.

### 3. Teacher enters student attendance presence

1. Teacher opens the extras workspace for a student.
2. Teacher edits `number of times present`.
3. The workspace shows `number of times opened` as read-only shared config.
4. The workspace calculates `number of times absent` automatically.

## Resolution Order

### `Next term begins`

1. class-group override
2. term default

### `Number of times opened`

1. class-group override
2. legacy class-level override if already stored
3. term default

### `Number of times absent`

- computed as `timesOpened - timesPresent`

## Database Schema

### Existing tables updated

- `academicTerms`
  - add optional `defaultTimesSchoolOpened`

### New tables

- `reportCardTermSettingGroups`
  - `schoolId`
  - `sessionId`
  - `termId`
  - `name`
  - `classIds`
  - `nextTermBegins?`
  - `timesSchoolOpened?`
  - `createdAt`
  - `updatedAt`
  - `updatedBy`

## UX Rules

- Admin should not have to repeat shared values class by class.
- Groups must reject overlapping classes within the same term.
- The teacher extras workspace should never let teachers edit `times opened`.
- The printable report card should reflect the resolved group/default value automatically.

## Regression Checks

- Existing term-level next-term date still works if no groups are configured.
- Existing teacher attendance presence entry still saves per student.
- Existing canonical absence field still prints calculated values.
- Existing classes without groups fall back to the term defaults cleanly.

## Implementation Status

- Planned for implementation in this slice.
