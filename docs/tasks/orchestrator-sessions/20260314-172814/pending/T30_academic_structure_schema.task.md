# T30 Academic Structure Schema

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-schema-validator` and `convex-functions`.
- Do not use `context7`.

## Objective

Implement the academic structure schema for sessions, terms, classes, subjects, class-subject-teacher assignments, and academic-mode configuration.

## Scope

Included: academic-year models, class models, subject models, assignment relations, relevant indexes.  
Excluded: student enrollment and score-entry records.

## Context

This task must support both primary and secondary teaching structures.

## Definition of Done

- Academic entities are defined with school scope.
- Assignment records support teacher-to-subject-to-class mapping.
- Primary and secondary configuration can coexist.

## Expected Artifacts

- Convex academic schema and helpers
- shared academic domain types

## Constraints

- Do not hardcode a single school model.
- Preserve term and session references for later billing and reporting joins.

## Verification

- Schema supports the example of one teacher teaching multiple subjects in one class and specialist teachers across the same class.

