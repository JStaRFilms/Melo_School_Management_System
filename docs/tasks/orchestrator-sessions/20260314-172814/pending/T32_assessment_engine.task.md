# T32 Assessment Engine

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-functions`.
- Do not use `context7`.

## Objective

Build the assessment scheme and calculation engine for CA scores, exams, totals, averages, ranking, and CGPA.

## Scope

Included: scheme definition, score storage shape, calculation utilities, derived academic metrics.  
Excluded: the result-entry UI itself.

## Context

This task fulfills the core logic behind `FR-006`.

## Definition of Done

- Score components and weights are modeled.
- Derived calculations are deterministic and reusable.
- School-level grading rules are supported.

## Expected Artifacts

- Convex calculation logic
- shared grade-related types and helpers

## Constraints

- Keep calculations auditable.
- Avoid duplicating formulas across multiple apps.

## Verification

- Automated checks cover totals, averages, ranking, and CGPA for representative scenarios.

