# Result: T01 Foundation Domain And Schema

**Status:** Success  
**Completed At:** 2026-03-27T23:34:19+01:00  
**Completed By:** External implementer + spec review + code-quality review  
**Workflow Used:** `/vibe-build`  
**Skills Applied:** `takomi`, `nextjs-standards`, backend/domain helpers already present in repo

## Output

- [x] Added school-scoped schema/domain support for reusable report-card scales, bundles, class assignments, and per-student extra values.
- [x] Added compatibility first-name/last-name handling while preserving legacy display-name behavior.
- [x] Extended report-card backend payload contracts with printable extras metadata for downstream UI integration.
- [x] Added explicit Nursery-safe level normalization in backend class flows.
- [x] Passed implementer self-check, spec-compliance review, and code-quality review.

## Artifacts

| File | Action | Notes |
| --- | --- | --- |
| `packages/convex/schema.ts` | Modified | Added report-card extras tables and split-name fields on `users`. |
| `packages/convex/functions/academic/reportCardExtras.ts` | Created | Added bundle, scale, assignment, and extras entry/query APIs. |
| `packages/convex/functions/academic/reportCardExtrasModel.ts` | Created | Added extras normalization, validation, and printable composition helpers. |
| `packages/convex/functions/academic/studentNameCompat.ts` | Created | Added display-name compatibility and safe backfill helpers. |
| `packages/convex/functions/academic/studentEnrollment.ts` | Modified | Added split-name support and compatibility reads/writes for students. |
| `packages/convex/functions/academic/reportCards.ts` | Modified | Added extras payload composition and compatibility student naming fields. |
| `packages/convex/functions/academic/academicSetup.ts` | Modified | Added Nursery-safe class level normalization and split-name-aware teacher creation. |
| `packages/shared/src/components/ReportCardSheet.tsx` | Modified | Added contract-only report-card type fields for name/extras alignment. |
| `packages/convex/_generated/api.d.ts` | Modified | Regenerated Convex API types. |

## Review Notes

- Spec review initially flagged an out-of-scope UI render addition and missing explicit Nursery-safe handling; both were corrected before approval.
- Code-quality review approved the task and noted only non-blocking follow-ups around teacher split-name updates and extras uniqueness hardening.

## Verification

- [x] `pnpm -C "packages/convex" convex:codegen`
- [x] `pnpm -C "packages/shared" typecheck`
- [x] `pnpm -C "packages/convex" typecheck`
- [x] `pnpm -C "packages/convex" convex:codegen && pnpm -C "packages/shared" typecheck && pnpm -C "packages/convex" typecheck`
