# U2a — Grade policy and editor

Execution: implemented and locally verified; browser/rollout acceptance E0. See [result and exact contract](../results/U2a.md) and subsequent [consumer result](../results/U2b.md).

## Objective / scope
Make the existing grade-band editor persist configurable semantic colors through one compatible policy contract. No duplicate preset or historical rewrite.

## Context / dependencies
U1a/U1b; U1f group defaults contract. Read H1/F6 and matrix. `gradingBands.getGradingBands/updateGradingBands` support colorHex; live editor calls legacy `getActiveGradingBands/saveGradingBands` and maps away color. Factory defaults contain six grades including E; D04 five-row examples are not approved replacements. Read entire gradingBands.ts and current editor/type/test files.

## Ownership
`academic/gradingBands.ts`; Admin grading-bands page/components; Admin `lib/types.ts` grade types; shared grade-policy/calculation types and focused tests. U2b owns consumer rendering later. Schema/export changes serialized.

## Instructions
1. Reconcile legacy and new APIs without a second policy source or duplicate standard preset. Preserve score/remark semantics and backward compatibility. Require active branch and grading-management capability for writes; public reads still require appropriate scope.
2. Add curated preset + custom hex controls to desktop/mobile rows, live safe preview and accessible labels. Store selected hue; derive contrast-safe display shades mathematically rather than reject every light valid hue.
3. Carry color through actual draft/response/calculation/report contracts. Integrate group defaults/explicit permitted overrides from U1f, never infer inheritance solely from group membership.
4. Define historical rendering explicitly: preserve available issued snapshots; old issued records lacking policy use documented monochrome/text fallback, not today's changed grading thresholds. New certified outputs capture policy version. No backfill/migration execution.

## Definition of done / verification
Focused tests for ranges/gaps/overlaps, valid/invalid hex, defaults restore without duplicate, persistence through legacy adapter, light-color contrast, inherited/overridden policy and historic/no-policy behavior. Existing foundation/shared calculation suites and app/shared typechecks recorded. Editor handles loading/empty/denied/save/reset/dirty states and 320px keyboard use.

## Artifacts
`results/U2a.md` with exact policy/type/API and historical contract, tests/self-review, U2b handoff. Update matrix. No provider/production/migration/deploy/credential/PR actions; follow plan safety and parent review ownership.
