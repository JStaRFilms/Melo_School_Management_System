# ADR-010: Consolidation Owner Decisions

**Date:** 2026-09-26
**Status:** Accepted
**Deciders:** Repository owner
**Related:** Issue #73, PR #49

## Context

Issue #73 parked four product decisions before the consolidation branch could merge. The owner answered them on 2026-09-26. This record is the target those answers point at.

## Exam score display precision

Every surface that renders a computed exam score prints two decimal places: the admin results roster, the teacher exam entry roster, the report card workbench summary, the report card sheet, and the portal results views.

The calculation itself does not change. `packages/shared/src/exam-recording/calculations.ts` already rounds scaled and total scores to two decimals, and grades still come from `floor(total)`. A stored total of 79.67 renders as 79.67 and keeps the grade it had before.

The admin and teacher roster grids are no longer forked. PR #68 left them split because admin printed totals as whole percentages while the teacher grid printed two decimals, and unifying them without a decided contract would have changed visible grades. The contract is now decided: two decimals everywhere.

## Group inheritance winner

`groupSettingVersions` with `branchSettingOverrides` is the winning system for all eight group domains.

The losing system is the inline defaults: `gradingDefault`, `admissionNumberDefault` and `brandingDefault` on `schoolGroups`, plus the `gradingMode`, `admissionNumberFormat` and `brandingOverride` flags on `schoolGroupBranches`.

No reader moves in PR #49. Switching the grading band, admission number format or branding readers to the versioned contract changes the effective values that branches resolve, so that migration ships on its own branch after this merge. Naming the winner here is what issue #73 story 10 asked for.

## Admissions identity ambiguity

The foundation V1 resolver in `packages/convex/functions/foundation/auth.ts` fails closed. Two live `users` rows for one school under one token throw `RECONCILIATION_REQUIRED`, and so does a scan that fills the 100 row verification limit. Before this decision the resolver took the first matching row and authorized it.

The trade is deliberate. A duplicate row locks that account out of the admissions workspace until an operator reconciles it, which is disruptive. Silently authorizing one of two conflicting identities is worse, and the strict resolver in `functions/academic/auth.ts` already behaves this way everywhere else.

## Scheduler identity

The scheduler identity fix in `packages/convex/functions/academic/admissionNumbers.ts` is accepted as written. It authorizes from the persisted conversion requester only when no ambient identity exists, and only after school match, membership linkage, membership uniqueness and a fresh capability check at execution time.

What remains is proof rather than code. Run a governed manual number conversion against production after the backend deploy and record the result.
