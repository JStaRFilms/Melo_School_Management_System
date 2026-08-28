# Melo Curriculum Judge Demo Tenant

## Goal

Create a deterministic, resettable judge school for the Curriculum Intelligence hackathon demo. It should match the existing Demo Academy's full-school shape while adding a prepared Curriculum Intelligence journey: indexed curriculum source, admin extraction and review, approved topic, inherited teacher source, prepared lesson evidence, and readiness reporting.

The seed must create real Better Auth credentials and school-scoped Convex data without modifying or resetting `demo-school` or another tenant.

## Proposed Demo Identity

- **School:** Codex Academy
- **Slug:** `codex-academy`
- **Admin:** Amina Codex
- **Teacher:** Ada Terra
- **Parent:** Grace Nova
- **Students:** Terra Okafor, Luna Mensah, Sol Adeyemi, and Sora Bello
- **School population:** three classes, 36 students, 18 families, seven subjects, and multiple teachers, matching the established demo-tenant scale
- **Operational data:** assessments across all three terms, report-card evidence, fees/invoices/payments, events, portal relationships, planning materials, and question-bank data
- **Featured academic context:** JSS 1, Social Studies, Second Term within the active 2025/2026 session
- **Prepared source:** `JSS 1 Social Studies — Second Term Scheme of Work`

Names are fictional and use light OpenAI/Codex references without turning the judge experience into a joke.

## Components

### Operator command

- Add a dedicated root command such as `pnpm judge:seed`.
- Require an explicit confirmation phrase, target deployment identity, environment, and operator token.
- Production additionally requires a temporary allow-production flag and a production-only confirmation phrase.

### Convex Node runner

- Reconcile the admin, teacher, and parent Better Auth credential accounts.
- Refuse to reuse an email or auth ID connected to another school or a platform administrator.
- Invalidate old judge-account sessions when the tenant is reset.
- Coordinate bounded cleanup and the small school-data seed.

### Convex seed mutations

- Reset only `schools.slug = codex-academy` and its school-scoped children.
- Create the same complete operational fixture as Demo Academy: school, users, leadership, active session, three terms, three classes, seven subjects, teacher assignments, 18 families, 36 fictional students, assessment history, report cards, billing, events, planning resources, and portal relationships.
- Create one approved, ready, indexed `imported_curriculum` material with page-aware chunks for five Second Term Social Studies weeks.
- Seed one previously approved curriculum unit/topic and one prepared lesson artifact so the teacher and readiness portions of the demo never depend on a live generation finishing during recording.
- Leave additional source weeks unapproved so the admin can demonstrate a fresh extraction, edit, and approval.

### Tests

- Operator-gate tests for development/preview and production.
- Cross-tenant auth conflict protection.
- Bounded reset that preserves another school.
- Seed integration assertions for accounts, academic context, curriculum material/chunks, approved unit/topic, inherited source, lesson artifact, and readiness evidence.

## Data Flow

```text
operator runs judge:seed with explicit deployment gates
  -> runner verifies target and account ownership
  -> runner resets only codex-academy in bounded batches
  -> Better Auth accounts are created or reconciled
  -> school-scoped academic and curriculum fixture is inserted
  -> validation confirms the judge journey is ready
  -> credentials and seeded counts are returned to the operator
```

## Database Schema

No new product tables are planned. The seed reuses existing tables, including:

- `schools`, `users`, `schoolAdminLeadership`
- `academicSessions`, `academicTerms`, `classes`, `subjects`, `teacherAssignments`
- `families`, `students`, `familyMembers`
- `knowledgeMaterials`, `knowledgeMaterialChunks`, `knowledgeTopics`
- `curriculumImports`, `curriculumUnits`
- `instructionArtifacts`, `instructionArtifactSources`
- existing audit/run records where required

If a durable judge-seed run marker is needed for safe retries, extend the existing seed-run mechanism with an explicit seed profile rather than introducing an unscoped cleanup ledger.

## Security and Reset Rules

- Never accept a school ID from the caller; the server owns the fixed judge-school slug.
- Never store the judge password in committed source. Read it from a protected deployment environment variable.
- Never reset production without both the temporary production flag and the exact production confirmation phrase.
- Never delete Better Auth identities merely because the school seed fails.
- Never touch `demo-school`, platform administrators, or unrelated tenants.
- Remove the temporary production seed flag and operator token after the final judge tenant is prepared.

## Acceptance Criteria

- The seed is deterministic and safe to rerun.
- Existing `demo-school` data remains unchanged.
- Admin, teacher, and parent credentials can authenticate.
- The admin sees the prepared indexed curriculum source.
- A new curriculum proposal can be generated from the seeded source.
- At least one approved seeded topic appears in teacher planning with the curriculum source inherited and counted.
- At least one prepared lesson appears in readiness evidence.
- Reset and seed behavior is covered by focused Convex tests, including full-school count parity with the existing demo profile.
- Convex type-check, relevant builds, and `pnpm convex deploy` pass before handoff.

## Approval Gate

Implementation begins only after the user confirms this full-school judge tenant and the proposed fictional identities. The public/production seed will not be executed until the target deployment variables and final judge password are deliberately configured.

## Implementation Status (2026-07-20)

Implemented as a second profile of the existing phased full-school seed rather than a disconnected fixture. Demo Academy remains the default profile and retains its existing command and behavior.

### Commands

- Demo Academy: `pnpm demo:seed '<gated arguments>'`
- Codex Academy: `pnpm judge:seed '<gated arguments>'`

The judge runner requires `JUDGE_DEMO_PASSWORD`, `JUDGE_SEED_OPERATOR_TOKEN`, `JUDGE_SEED_DEPLOYMENT_IDENTITY`, and `JUDGE_SEED_DEPLOYMENT_ENV`. Production also requires temporary `JUDGE_SEED_ALLOW_PRODUCTION=true` and the exact phrase `RESET codex-academy IN PRODUCTION`.

### Seeded school shape

- 3 classes and 36 students across JSS 1A, JSS 1B, and JSS 2A
- 18 families, three staff identities, additional seeded teachers, and parent/student portal relationships
- 7 subjects with class-subject and teacher assignments
- 3 academic terms with 756 assessment records and report-card evidence
- 36 invoices with deterministic manual payment examples
- School events, planning materials, lesson templates, a question bank, and student-approved resources
- One ready five-page JSS 1 Social Studies Second Term curriculum source
- One approved curriculum unit/topic with an inherited source and prepared lesson plan for readiness

### Verification

- Convex type-check passes.
- Ten focused seed gate/integration tests pass.
- The development tenant was successfully reset and reseeded; the final reset removed 1,971 tenant-scoped rows before recreating 36 students, 3 classes, 36 invoices, and 756 assessment records.
- Production seeding remains intentionally deferred until the frontend branch is merged and the production-only gates are configured.
