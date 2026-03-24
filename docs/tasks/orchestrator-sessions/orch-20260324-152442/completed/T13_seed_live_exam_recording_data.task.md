# T13 Seed Live Exam Recording Data

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Create the minimum live dataset required to exercise the admin and teacher exam-recording flows end to end on a real Convex deployment.

## Scope

Included:
- one repeatable seed path for a real local/dev deployment
- one school record
- one admin user mapped to a real Better Auth identity
- one teacher user mapped to a real Better Auth identity
- one session and one term
- one class and one or more subjects
- teacher assignment(s)
- two or more students with linked user rows
- active school assessment settings
- active grading bands
- one pre-filled assessment sheet for edit/update testing

Excluded:
- bulk admissions onboarding beyond the minimum sample data
- production migration strategy
- multi-school seeding beyond one reliable test tenant

## Context

Use:
- `packages/convex/schema.ts`
- exam-recording backend functions in `packages/convex/functions/academic`
- auth identity mapping produced by `T11`
- live deployment wiring produced by `T12`

## Definition Of Done

- [x] A signed-in admin can authenticate with seeded credentials and load settings, grading bands, and a real roster sheet.
- [x] A signed-in teacher can authenticate with seeded credentials and load an assigned class-subject sheet.
- [x] Seeded records are repeatable enough for local live testing without duplicating the demo tenant.

## Expected Artifacts

- [x] Internal seed mutation in `packages/convex/functions/academic/seed.ts`
- [x] Public seed runner action in `packages/convex/functions/academic/seedRunner.ts`
- [x] Minimal seed usage and verification notes in the completed task result

## Constraints

- [x] Keep the seed narrow and test-oriented.
- [x] Use realistic relationships so authorization rules are exercised properly.
- [x] Align `users.authId` to real Better Auth user ids for the seeded admin and teacher.

## Verification

- [x] Confirm admin and teacher users both resolve to the correct `schoolId`.
- [x] Confirm the seeded teacher assignment unlocks the teacher exam-entry page.
- [x] Confirm at least one roster sheet exists with real students and prefilled scores.
- [x] Confirm the seed can be rerun without creating a duplicate `demo-school`.

## Seed Usage Instructions

### Deploy the latest seed code

```bash
pnpm convex:dev --once
```

### Run the live seed

```bash
pnpm exec convex run functions/academic/seedRunner:seedExamRecordingData
```

### Optional custom credentials

```bash
pnpm exec convex run functions/academic/seedRunner:seedExamRecordingData ^
  "{\"adminEmail\":\"admin@example.com\",\"adminPassword\":\"Admin123!Pass\",\"teacherEmail\":\"teacher@example.com\",\"teacherPassword\":\"Teacher123!Pass\"}"
```

### What gets seeded

| Table | Records | Details |
| --- | --- | --- |
| schools | 1 | Demo Academy (`demo-school`) |
| users | 5 | 1 admin, 1 teacher, 3 students |
| academicSessions | 1 | `2025/2026` |
| academicTerms | 1 | `First Term` |
| classes | 1 | `JSS 1A` |
| subjects | 3 | Mathematics, English Language, Basic Science |
| teacherAssignments | 2 | Teacher -> Mathematics + English Language in JSS 1A |
| students | 3 | Alice, Bob, Carol with linked user rows |
| schoolAssessmentSettings | 1 | `raw40` mode, `20 + 20 + 20 + 40` |
| gradingBands | 6 | F, E, D, C, B, A bands covering `0-100` |
| assessmentRecords | 3 | Pre-filled Mathematics scores for First Term |

### Default seeded credentials

- Admin: `admin@demo-academy.school` / `Admin123!Pass`
- Teacher: `teacher@demo-academy.school` / `Teacher123!Pass`

### Idempotency

The public seed action creates or reuses the Better Auth users, then calls an internal mutation that checks for the `demo-school` slug. If the tenant already exists, it returns the existing ids instead of duplicating data.
