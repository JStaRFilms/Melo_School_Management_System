# ADR-010: Consolidation Owner Decisions

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Repository owner
**Related:** Issue #73, PR #49

## Context

Issue #73 parked four product decisions before the consolidation branch could merge. The owner answered them on 2026-09-26. This record is the target those answers point at.

## Decision

1. **Exam score display precision.** Every surface that renders a computed exam score prints two decimal places: the admin results roster, the teacher exam entry roster, the report card workbench summary, the report card sheet, and the portal results views. The calculation and the grading rule do not change.
2. **Group inheritance winner.** `groupSettingVersions` with `branchSettingOverrides` wins for all eight group domains. The inline defaults lose, and no reader migrates in the consolidation merge.
3. **Admissions identity ambiguity.** The live admissions identity path fails closed with `RECONCILIATION_REQUIRED`. A token with conflicting rows in the requested school is never authorized silently, and the conflict never revokes its access to other schools.
4. **Scheduler identity.** The existing scheduler fix is accepted as written. Only production proof remains.

## Exam score display precision

`packages/shared/src/exam-recording/calculations.ts` already rounds scaled and total scores to two decimals, and grades still come from `floor(total)`. A stored total of 79.67 renders as 79.67 and keeps the grade it had before.

PR #68 left the admin and teacher roster grids forked because admin printed totals as whole percentages while the teacher grid printed two decimals, and unifying them without a decided contract would have changed visible grades. The contract is now decided: two decimals everywhere. The code lands on the precision branch that merges into the same integration branch as this one, so the two ship together; this ADR states the contract rather than reporting the merge.

## Group inheritance winner

`groupSettingVersions` with `branchSettingOverrides` is the winning system for all eight group domains: the five already carried by the versioned contract (`role_templates`, `report_card_template`, `notification_preferences`, `academic_policy`, `calendar_template`) plus the three still living as inline defaults.

The losing system is the inline defaults: `gradingDefault`, `admissionNumberDefault` and `brandingDefault` on `schoolGroups`, plus the `gradingMode`, `admissionNumberFormat` and `brandingOverride` flags on `schoolGroupBranches`.

No reader moves in PR #49. Switching the grading band, admission number format or branding readers to the versioned contract changes the effective values that branches resolve, so that migration ships on its own branch after this merge. Naming the winner here is what issue #73 story 10 asked for.

## Admissions identity ambiguity

The foundation V1 resolver in `packages/convex/functions/foundation/auth.ts` fails closed. Two live `users` rows for one school under one token throw `RECONCILIATION_REQUIRED`, and so does a scan that fills the 100 row verification limit. Before this decision the resolver took the first matching row and authorized it, with a silent 100 row cap.

The duplicate check is judged against the school the caller asked for, so a duplicate row in one tenant never revokes the token's access to another tenant. The scan limit stays identity-wide, because a scan too large to verify cannot support any school.

The limit counts every row the token resolves, including archived ones, because a scan large enough to crowd out verification is not verifiable either way. The trade is deliberate: a duplicate row locks that account out of the admissions workspace until an operator reconciles it, which is disruptive. Silently authorizing one of two conflicting identities is worse, and the strict resolver in `functions/academic/auth.ts` already behaves this way everywhere else.

## Scheduler identity

The scheduler identity fix in `packages/convex/functions/academic/admissionNumbers.ts` is accepted as written. It authorizes from the persisted conversion requester only when no ambient identity exists, and only after school match, membership linkage, membership uniqueness and a fresh capability check at execution time.

What remains is proof rather than code. Run a governed manual number conversion against production after the backend deploy and record the result.
