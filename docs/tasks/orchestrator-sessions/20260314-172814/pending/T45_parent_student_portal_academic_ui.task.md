# T45 Parent and Student Portal Academic UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the academic side of the portal, including dashboards, result history, report-card access, academic notifications, and student switching for parents.

## Scope

Included: parent and student dashboard views, report-card pages, academic alerts, linked-student switching.  
Excluded: billing views already covered in `T40`.

## Context

This task fulfills `FR-009` and closes the portal experience beyond payments.

## Definition of Done

- Parents and students can access the correct academic views.
- The portal reflects the approved mockups and role boundaries.

## Expected Artifacts

- academic portal routes and components in `apps/portal`

## Constraints

- Parents must see only linked students.
- Students must see only their own records.

## Verification

- Parent and student users reach different but consistent academic dashboards and record pages.

