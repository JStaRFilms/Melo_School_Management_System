# School Events Archive Restore

## Goal

Add a first event lifecycle slice so school events can be created, archived, and restored without hard deletion.

This feature is intentionally scoped to:

- storing school-scoped events
- managing them from the admin app
- making archived events visible and restorable from the archive browser

## Components

### Client

- `apps/admin/app/academic/events/page.tsx`
  - create events
  - edit active events
  - archive active events
- `apps/admin/app/academic/archived-records/page.tsx`
  - restore archived events
- `apps/admin/app/academic/archived-records/components/*`
  - include `event` in archive filters, badges, and details
- `packages/shared/src/workspace-navigation.ts`
  - expose the admin route for events

### Server

- `packages/convex/schema.ts`
  - add a `schoolEvents` table with archive metadata
- `packages/convex/functions/academic/events.ts`
  - list, create, update, archive, and restore events
- `packages/convex/functions/academic/archiveRecords.ts`
  - include archived events in the archive browser query

## Data Flow

1. Admin creates a school event with title, date window, and optional metadata.
2. The event appears in the active event list.
3. Admin archives the event instead of deleting it.
4. The event leaves the active list and appears in the archive browser.
5. Admin restores the event from the archive browser when needed.
6. The restored event returns to the active event list with its original identity preserved.

## Database Schema

### New Table: `schoolEvents`

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `title` | string | Event title |
| `description` | string? | Optional event summary |
| `location` | string? | Optional venue |
| `startDate` | number | Start timestamp |
| `endDate` | number | End timestamp |
| `isAllDay` | boolean | All-day flag |
| `isArchived` | boolean? | Archive state |
| `archivedAt` | number? | Archive timestamp |
| `archivedBy` | id("users")? | Admin who archived it |
| `createdAt` | number | Created timestamp |
| `updatedAt` | number | Updated timestamp |
| `updatedBy` | id("users") | Last admin editor |

Suggested indexes:

- `by_school`
- `by_school_and_start`

## Notes

- This slice focuses on admin event lifecycle only.
- Public calendar presentation and event registration can build on top of the same `schoolEvents` records later.
- Archive/restore keeps event identity stable so later website, portal, or notification links do not depend on destructive deletes.
