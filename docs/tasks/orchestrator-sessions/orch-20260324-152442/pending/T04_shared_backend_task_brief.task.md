# T04 Shared Domain And Backend Task Brief

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-spawnTask`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-spawnTask`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `convex`, and `nextjs-standards`.
- Do not use `context7`.

## Objective

Create a self-contained implementation brief for the shared domain and backend slice of Exam Recording v1.

## Scope

Included:
- shared types and validators
- school assessment settings
- grading bands
- assessment record schema
- calculation and scaling logic
- bulk roster fetch query
- bulk upsert mutation
- teacher assignment authorization
- admin override authorization
- school boundary enforcement
- tests

Excluded:
- teacher UI code
- admin UI code

## Context

Use:
- `docs/features/ExamRecording.md`
- `docs/issues/FR-006.md`
- `docs/issues/FR-007.md`
- `docs/Coding_Guidelines.md`

## Definition Of Done

- A detailed task brief exists in `docs/tasks/`.
- The brief contains acceptance criteria, test scenarios, and implementation phases.

## Expected Artifacts

- `docs/tasks/ExamRecording_SharedDomainAndBackend.md`

## Constraints

- The brief must be specific enough for a build agent to execute without product questions.
- Keep the backend plan school-aware and auditable.

## Verification

- Confirm the brief covers `/40` and `/60 -> /40` rules.
- Confirm audit fields and saved derived values are included.
