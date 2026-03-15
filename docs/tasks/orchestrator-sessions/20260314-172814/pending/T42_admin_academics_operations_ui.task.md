# T42 Admin Academics Operations UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the admin academic-operations UI for classes, subjects, assignments, enrollments, result oversight, and support panels.

## Scope

Included: academic setup screens, assignment management, enrollment management, results oversight.  
Excluded: teacher-facing result entry forms.

## Context

This task is the admin UI layer for `FR-004`, `FR-005`, and the oversight portion of `FR-007`.

## Definition of Done

- Admins can configure academic structures end to end.
- Admin oversight views connect to the backend services already created.

## Expected Artifacts

- academic operations routes and components in `apps/admin`

## Constraints

- Keep support panels read-only.
- Do not duplicate business logic already implemented in backend services.

## Verification

- Admins can create structures, assign teachers, and inspect result states without permission leaks.

