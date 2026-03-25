# T15 Admin Academic Setup UI Mockups

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-design`

## Agent Setup

- Read `/vibe-design`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `frontend-design`, `ui-ux-pro-max`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Design the admin and teacher mockups for academic setup and student subject enrollment so implementation can proceed with clear UX direction.

## Scope

Included:
- teacher creation screen
- session and term setup screen
- subject catalog management screen
- class creation / editing screen
- class subject offering selection screen
- student roster entry screen
- student subject enrollment checkbox matrix
- teacher-facing subject-selection editing screen for assigned classes
- mobile and desktop states where they materially differ

Excluded:
- implementation code
- parent onboarding
- bulk import
- full admissions workflows

## Context

Use:
- `docs/project_requirements.md`
- `docs/features/AdminAcademicSetupEnrollment.md`
- existing admin visual language from `docs/design/design-system.html`
- existing admin mockup patterns in `docs/mockups/admin/`

## Definition Of Done

- [x] mockups clearly show how an admin adds teachers, subjects, classes, students, and student subject selections
- [x] mockups clearly show how an admin creates sessions and terms before class/result work begins
- [x] mockups clearly show that teachers can edit subject selections for existing students but cannot add students
- [x] the checkbox enrollment flow is understandable on desktop and acceptable on mobile
- [x] empty, loading, validation, and success states are shown where needed

## Expected Artifacts

- [x] HTML mockups in `docs/mockups/admin/`
- [x] short result note describing the delivered screens and states

## Constraints

- [x] keep the UX compact and operational, not marketing-styled
- [x] preserve the established admin editorial/precision design direction
- [x] favor fast setup flow over ornamental complexity
- [x] make the permission split visible in the screens:
  - admin adds students and can edit subjects
  - teacher edits subjects only for existing students

## Verification

- [x] confirm the screens cover the exact user flow:
  - create teacher
  - create session and term
  - create subject
  - create class
  - add students
  - assign subjects per student as admin
  - edit subjects per student as teacher
