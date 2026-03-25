# T17 Platform Super Admin and School Provisioning

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-spawnTask`

## Agent Setup

- Read `/vibe-spawnTask`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `avoid-feature-creep`, `convex`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Define the later implementation slice for platform-level multi-school provisioning, where the product owner can create schools and assign each school its own admin.

## Scope

Included:
- platform super admin role and responsibilities
- create school flow
- assign school admin flow
- minimum tenant bootstrap requirements
- boundaries between platform admin and school admin

Excluded:
- implementation now
- custom domains
- advanced billing for schools
- support tooling beyond minimum provisioning

## Context

Use:
- `docs/project_requirements.md`
- `docs/features/PlatformSuperAdminSchoolProvisioning.md`
- current school-scoped architecture already in place

## Definition Of Done

- the later platform slice is captured clearly enough to delegate without reopening product questions
- the task keeps the current one-school delivery path intact

## Constraints

- do not expand the current school-admin setup slice
- preserve the one-backend, multi-tenant direction unless a future explicit decision changes that
- keep this as a later task after the current school's academic setup work

## Verification

- confirm the task treats platform super admin as distinct from school admin
- confirm the task assumes school admins handle teacher/class/student/result setup inside their own tenant
