# T29 Core School, Person, and Membership Schema

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-schema-validator` and `convex-functions`.
- Do not use `context7`.

## Objective

Implement the backend schema and validators for schools, people, memberships, and shared role context.

## Scope

Included: school records, branding fields, people records, role memberships, tenant context helpers.  
Excluded: academic and billing domain tables.

## Context

This task is the data backbone for `FR-001`, `FR-002`, and `FR-003`.

## Definition of Done

- Core tenant and person models exist.
- Validators and indexes support common lookups.
- Shared types align with the PRD and issue pack.

## Expected Artifacts

- Convex schema updates
- shared core types in packages

## Constraints

- Keep school context explicit in every relationship.
- Support multi-role memberships.

## Verification

- Core queries and mutations compile and resolve expected ids and relationships.

