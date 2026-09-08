# U2b — Grade consumers and print/history propagation

Execution: implemented and locally verified; browser/print/rollout acceptance E0. See [consumer/API manifest, checks and U7 evidence requests](../results/U2b.md).

## Objective / scope
Propagate the U2a effective grade color to every actual score/report consumer without changing grade math or status/theme semantics.

## Context / dependencies
U2a complete. Read H1, matrix consumer rows and U2a exact contract. Real hard-coded consumers: shared ReportCardSheet.gradeColor; Teacher exam entry RosterGrid mobile and RosterGridRow→ComputedColumns desktop; report-card-workbench ResultsSummary; Admin results AdminRosterGrid and AdminRosterGridRow; Portal PortalWorkspaceContent result table. Shared preview/print/batch wrappers carry sheet props. Extras/manual-adjustments routes may consume the shared report renderer rather than their own grade map.

## Ownership
Exact U2b files in plan, associated Admin/Teacher/Portal report wrappers/types and `academic/reportCards.ts` / `functions/portal.ts` payload seams as required. Coordinate Portal billing owner; no unrelated math/refactor. Shared sheet and print edits finish before U3d.

## Instructions
1. Trace API payload→type→calculation→component for desktop/mobile and all report cards, extras, manual adjustments and Portal results. Add each consumer or explicit no-grade-render exclusion to result manifest.
2. Use policy-resolved safe color, not per-letter assumptions; preserve score/letter/remark without color. Unknown grade/incomplete cumulative result retains current semantics.
3. Enforce U2a historical snapshot/no-policy rule for previews, single print, batch print and downloads. No current policy rewrite of certified history.
4. Preserve server assignments, linked-student Portal access and sensitive final-publish/adjustment capabilities. Do not broaden report query permissions to fetch policy.

## Definition of done / verification
Existing ExamEntryFlow/RosterGrid, shared report-card-sheet/calculation/cumulative tests plus focused custom-grade and history cases pass or blockers recorded. Test 320px and desktop render consistency, print pagination, grayscale legibility and numeric-only comprehension. Typecheck all changed workspaces. No leftover hard-coded mapping on inventoried active consumers.

## Artifacts
`results/U2b.md`: exact consumer/route/API manifest, exclusions, test/self-review results, print evidence requested for U7. Update matrix; browser evidence not claimed until captured. No backend live commands, migrations, provider/production/deploy/credential or PR operations.
