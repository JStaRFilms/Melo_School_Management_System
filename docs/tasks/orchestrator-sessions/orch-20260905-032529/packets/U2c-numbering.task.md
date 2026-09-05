# U2c — Numbering policy and enrollment transaction

## Objective / scope
Connect guided sequential admission numbering to actual enrollment, with safe manual overrides and a reusable reviewed import/transfer contract.

## Context / dependencies
U1a/U1b and U1f scope contract. Read H4/F2 and actual admissionNumbers.ts, studentEnrollment.createStudent and transfers.acceptDestinationTransfer. Policy read is unguarded; calendar-year/JSS1/campus defaults are illustrative; resetFrequency stored but not applied. Allocator helper has no ordinary enrollment caller; transfer uses it. Imports remain separate until U4b.

## Ownership
`admissionNumbers.ts`; studentEnrollment creation/override sections; proposed `/admin/settings/admission-numbering`; onboarding page/form numbering controls; relevant foundation tests. Complete before U3b edits onboarding. Schema changes serialized; no migration.

## Instructions
1. Add authorized versioned policy read/edit, constrained token builder/live preview, next-number confirmation, continuous default and actual academic-session/calendar reset handling. YEAR is academic-session start year. Model default/named branch and level scopes and permitted group-wide counters explicitly.
2. Validate bounded integer sequence/padding/tokens and uniqueness. Policy changes affect new enrollments only; never rename historical IDs or infer official counter from old import values.
3. Call atomic allocator helper in the successful enrollment mutation, not opening forms/drafts or a preceding client mutation. Rollback/retry must not consume successful numbers twice. Assigned numbers are never automatically reused; no gapless promise.
4. Separate manual-override permission, confirmation/reason and optional explicit advance decision; no implicit parsing of manual strings to advance. Publish proposal/commit seam for U4b missing-only imports and U6 destination acceptance.

## Definition of done / verification
Focused tests cover concurrent creates, failed transaction, abandoned form, replay, duplicates, resets/session year, format version, override denied/reason/explicit advancement and no reuse. UI handles unavailable policy/session, invalid input, stale preview, denied/save failure. Record tests and typechecks; future data reconciliation remains gated.

## Execution status

Partial local delivery recorded in `../results/U2c.md`; default branch numbering/settings and transactional enrollment are implemented and verified. Named/level/group counters and group template inheritance remain unimplemented code scope. Do not mark this packet complete based on U7 browser evidence.

## Artifacts
`results/U2c.md`: exact allocator/override/import contract and UI routes, tests/self-review, U4b/U6 handoff. Update matrix. No production, migrations, deployment, providers, credentials or Convex CLI invocation; parent owns review/PRs.
