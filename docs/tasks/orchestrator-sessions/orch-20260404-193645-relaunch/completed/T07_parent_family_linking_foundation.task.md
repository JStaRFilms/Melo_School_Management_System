# T07 Parent and Family Linking Foundation

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use the Takomi continue-build path after cumulative reporting is stable.

### Prime Agent Context
Read:

- `docs/Project_Requirements.md`
- `docs/issues/FR-005.md`
- `packages/convex/schema.ts`
- `packages/convex/functions/academic/studentEnrollment.ts`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `convex-schema-validator` | Membership modeling |
| `convex-functions` | Query and mutation design |
| `sync-docs` | Keep docs aligned |

## Objective

Add the missing parent/family-linking foundation so student academic and later billing flows can be attached to real family relationships.

## Scope

Included:

- parent identity and linkage model
- student-parent association flows
- admin-side management foundations

Excluded:

- full parent portal
- billing implementation

## Definition of Done

- parents/families are represented cleanly in the data model
- student records can be linked to parents without breaking current academic flows
