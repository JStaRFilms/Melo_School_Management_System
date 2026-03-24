# T13 Seed Live Exam Recording Data

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Create the minimum live dataset required to exercise the admin and teacher exam-recording flows end to end on a real Convex deployment.

## Scope

Included:
- one seed path for a real local/dev deployment
- one school record
- one admin user mapped to a real auth identity
- one teacher user mapped to a real auth identity
- one session and one term
- one class and one or more subjects
- teacher assignment(s)
- two or more students with linked user rows
- active school assessment settings
- active grading bands
- optional one pre-filled assessment sheet for edit/update testing

Excluded:
- bulk admissions onboarding beyond the minimum sample data
- production migration strategy
- multi-school seeding beyond one reliable test tenant

## Context

Use:
- `packages/convex/schema.ts`
- exam-recording backend functions in `packages/convex/functions/academic`
- auth identity mapping produced by `T11`

## Definition Of Done

- A signed-in admin can load settings, grading bands, and a real roster sheet.
- A signed-in teacher can load an assigned class-subject sheet.
- Seeded records are repeatable enough for local live testing.

## Expected Artifacts

- Seed mutation/script/import workflow
- Minimal seed data instructions or result note

## Constraints

- Keep the seed narrow and test-oriented.
- Use realistic relationships so authorization rules are exercised properly.

## Verification

- Confirm admin and teacher users both resolve to the correct `schoolId`.
- Confirm the seeded teacher assignment unlocks the teacher exam-entry page.
- Confirm at least one roster sheet loads with real students.
