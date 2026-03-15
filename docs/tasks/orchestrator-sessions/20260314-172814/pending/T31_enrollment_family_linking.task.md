# T31 Enrollment and Family Linking

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-functions` and `convex-security-check`.
- Do not use `context7`.

## Objective

Implement student enrollment, class placement, subject subscription, and parent-student relationship management.

## Scope

Included: student-to-class links, student-to-subject links, parent/guardian linking, lifecycle-safe enrollment updates.  
Excluded: invoice generation and report-card rendering.

## Context

This task connects people to the academic domain and later to billing.

## Definition of Done

- Students can be placed in classes and subjects.
- Guardians can be linked to one or more students.
- Security checks prevent cross-school family access.

## Expected Artifacts

- Convex enrollment models and mutations
- supporting shared types

## Constraints

- Handle class changes without destroying historical integrity.

## Verification

- Enrollment and parent-link flows compile and preserve school scoping.

