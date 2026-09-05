# U1g — Proprietor aggregate overview and safe drilldown

## Objective / scope
Add aggregate school-group operations to the U1c metadata overview without broadening branch access or exposing raw student/staff/finance records.

## Context / dependencies
U1c/U1d; U1b branch-switch contract. Read F2/F1 and groups.getGroupOverview/getGroupOverviewHelper. Current return is group plus branch metadata only; any active group-branch member may access it. No enrollment/attendance/finance/staffing/academic dashboard API is implemented by that function.

## Ownership
Proposed `academic/groupOverview.ts`, Admin `/admin/group` overview components after U1c; groups overview authorization changes if needed after U1c, serialized with U1f's separate settings section. Focused group overview tests; no unrelated dashboard redesign.

## Instructions
1. Use existing domain source queries/helpers/count semantics for five summary dimensions: enrollment, attendance, finance, staffing and academics. Define time/session/term filters, units and exclusions; do not count archived/historical rows as active enrollment or call absence zero.
2. Verify proprietor/group-summary authority and explicit operational branch scope before reading any branch. Department/branch-limited users see only permitted metrics and authorized drilldown; Platform governance does not gain blanket school operational access.
3. Return bounded safe aggregates and branch summary rows. Do not serialize student rosters/prompts/bank data into overview payload. Avoid unbounded full-table aggregation; use available bounded/indexed counters or clearly label unavailable dimension until a correct bounded source is implemented.
4. Drilldowns use U1b selected-branch contract and supported actual routes with dirty guards, never just relabel header or invent dashboard paths. Suspended/revoked branch state remains explicit.

## Definition of done / verification
Tests cover known synthetic aggregate totals, archived/student exclusions, period filters, limited branch/module visibility, unrelated branch injection, empty vs unavailable, and drilldown scope. Record local tests/typecheck and UI keyboard/320px behavior. No database counting probes or production reads for sample metrics.

## Artifacts
`results/U1g.md`: metric source/function/units/scope manifest, tests/self-review and U7 proprietor/denied/partial-state screenshots. Update matrix. No provider, production, migration, deployment, credentials or unapproved Convex/PR operations.
