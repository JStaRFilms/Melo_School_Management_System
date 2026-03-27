# T04 Student-First Onboarding UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi` and `nextjs-standards`.
- Do not begin until `T00` is approved and `T01` is complete.

## Objective

Create a dedicated student-first onboarding route while keeping the current class-first student matrix flow intact.

## Write Scope

- `apps/admin/app/academic/students/onboarding/**`
- only minimal cross-linking changes in the current student enrollment route
- class-level UI files that need Nursery support

## Responsibilities

- dedicated onboarding route
- first-name and last-name inputs
- guardian/contact fields
- class chosen later in the flow
- reuse existing validation and photo rules where possible
- clean coexistence with the current `/academic/students` page

## Definition Of Done

- new route creates students successfully
- current `/academic/students` flow still works
- Nursery is available anywhere this onboarding path depends on class-level selection
- compatibility display names still render in existing screens and report cards
