# U1g — Operational overview scope and truthful unavailable states

**Status: PARTIAL / E0. Numeric aggregate dashboards and operational drilldowns are NOT implemented.** Added a real bounded authorization/filter/status API and Admin integration; every metric value remains null/unavailable or denied. The packet explicitly permits unavailable dimensions instead of unbounded/fabricated aggregation; this is that safe boundary, not completion of the dashboard requirement. Work followed the U1f branding implementation; final test/self-review bundle covers both. No database counting probes, production/sample reads, provider calls, live Convex CLI, deployment, migration, credential access, server/browser launch or commits.

## API and authority

Public API: `api.functions.academic.groups.getOperationalOverview({groupId,branchId?,startDate,endDate})`, implemented by `academic/groupOverview.ts` helper. Registered in the existing generated module, no generated file edits.

- Active canonical recorded proprietor required. Ordinary linked-branch members and Platform-only governance operators are rejected. Delegated group-summary roles/department summaries have **not** been enabled because no approved explicit group-summary scope exists in the current catalog.
- Group links are bounded to 101 rows with explicit overflow above 100. A supplied branch filter must be an exact link in that group, otherwise forbidden.
- Link/name/status metadata is allowed by group ownership. Before any operational source could be used, every active branch goes through `resolveActiveMembership`; canonical membership ID is mandatory and Platform support bypass is rejected. Revoked/missing membership returns `access:'denied'`, zero metrics and no drilldown. Suspended/missing/nonactive school returns `access:'inactive'`.
- Scoped branches then get per-dimension capability and module checks. Current candidate gates: enrollment `enrollment.intakes.manage` + admissions feature; finance `finance.reports.view` + billing; staff `staff.list.view`; academics `academic.report_cards.preview` + curriculum. Attendance has no approved summary capability and stays denied. These are conservative gates for unavailable placeholders, **not approval to reuse them for future broad data metrics without source/department review**.
- No student, attendance, invoice/payment, staff roster or score table is queried by this implementation. It returns safe branch metadata, metric labels/units/state/reason with `value:null`, five unavailable group totals, applied period and explicit limitations. No private records/prompts/bank data are serialized.

## Period and units/source manifest

Period is integer UTC epoch milliseconds, `startDate >= 0`, end exclusive, positive duration <=366 days. UI uses native date inputs; invalid ranges are rejected both client and server. Optional branch filter is authoritative. These dates currently **select no operational data**, because sources are unavailable; they are an applied contract only. Session/term mapping/comparison is unimplemented and disclosed, not inferred across independent branch calendars.

| Dimension | Inspected actual source / semantics | Output now | Work before numeric adoption |
|---|---|---|---|
| Enrollment | `studentEnrollment.listStudentsByClass`: default legacy school, class-owned `.collect()`, excludes archived student/user but not sufficient historical/duplicate/active status semantics. `students` has school/class indexes and optional enrollmentStatus; no bounded reviewed active counter found. | Null; unit active students; unavailable if permitted, else module-disabled/denied | Bounded counter/source with applicants, archived users/students, duplicate, graduated, withdrawn, transferred-out and historical-only exclusions; explicit as-of/session meaning. Do not count every legacy row as active. |
| Attendance | No dedicated bounded group-compatible attendance opportunity/presence source found; report/transfer attendance summary fields are not a complete denominator. | Null/denied; intended unit present / recorded attendance opportunities (%) | Approved attendance summary capability/scope, indexed period numerator/denominator and missing-data state; never call missing attendance zero. |
| Finance | `billing.getBillingDashboard`: no school argument, legacy default-admin gate, unbounded all invoices/payments/attempts/gateway events/fee-plan applications and provider-overview dependency. | Null; minor currency units separated by currency; unavailable/denied/disabled | Bounded explicit branch/period ledger aggregates; distinguish assessed, collected, outstanding, waived/refunded, school collection vs SaaS/settlement; no cross-currency sum. No provider invoked here. |
| Staffing | `academicSetup.listTeachers`: legacy default school, unbounded school users filtered by teacher role and archived flag, raw names/emails. Canonical memberships are not staff headcount. | Null; active staff people; unavailable/denied | Bounded canonical staff source with deduplication, employment/activity/branch assignment semantics; do not count guardians or students as staff memberships. |
| Academics | Existing grading/report/exam rows are per-domain and independently scoped; no comparable bounded published-score denominator/session/term aggregate found. | Null; published assessments with denominator; unavailable/denied/disabled | Approved bounded source, publication/finality and missing-score semantics, compatible grading/session/term comparison. Never average unrelated grading systems/terms or include draft scores as final. |

No known synthetic totals, archived-student counting or academic period-filtering acceptance is claimed: **there is no numeric aggregator to test yet**. Group totals stay null even if some branches are denied; a partial sum is never presented as a full-group total. An empty linked selection explicitly says it is not a zero total.

## Actual Admin route / drilldown

`/admin/group` now mounts `OperationalOverview.tsx` alongside the separate U1f settings section. It has native labelled start/end/branch controls, applied-period text, loading, denied/revoked/inactive/module-disabled/unavailable explanations, no-branches state and route-level query error/retry inherited from U1c. Layout uses wrapping controls and a responsive definition list, not a wide roster table. Group changes remount the section and reset its scoped filters.

**No drilldown link or button exists**: every row says selected-branch routes and unsaved-change guards must be approved. This follows U1b, where no switched operational route/caller chain is approved and U3a dirty guard is not installed. No invented route, header relabel, active-school persistence, unscoped dashboard query or group-link-as-membership workaround was added. Domain owners must establish selected-branch activation, query/entity reset and guarded navigation before enabling actual supported paths.

## Local tests and verification

See [U1f](U1f.md) for exact combined commands and ordinary fixes:
- New combined backend file: **5 PASS**, including **2 overview** cases covering five null totals, scoped/denied/inactive/module-disabled rows, Platform/member exclusion, revocation, foreign branch injection, exact branch filter, UTC period validation and no sensitive fields/drilldowns.
- New Admin file: **4 PASS**, including **1 overview** DOM case for loading, explicit denial, no fake link, native focus, invalid range and submitted exact period/branch contract.
- Final combined relevant backend bundle: **29 PASS**; Admin bundle: **13 PASS**.
- Convex/Admin/Platform/Shared/Teacher/Portal typechecks: **all six PASS**.
- Changed-file eslint and `git diff --check`: PASS (line-ending notices only).

Self-review: source reads are metadata/auth/capability only; no hidden `.collect()` aggregation, partial-window counts, raw DTO or provider dependency. Moved operational membership handling into overview instead of leaving it in settings. Per-branch auth errors fail closed; unexpected non-Convex errors propagate to retry boundary. Owner metadata visibility cannot bypass branch membership. Removed new configuration fields from old group metadata projections. Empty/unavailable/denied remain distinct.

## Files, acceptance remaining and U7 handoff

Created `academic/groupOverview.ts`, Admin `app/admin/group/OperationalOverview.tsx`, this result. Modified groups API registrations and Admin group page; shares `groupDefaultsOverview.integration.test.ts` and `group-defaults-overview.test.tsx` with U1f. Existing metadata behavior/Platform UI otherwise preserved.

Remaining implementation: all five bounded source adapters/counters, actual totals/exclusion tests, session/term filters/comparability, explicitly delegated summary scopes and dimension permissions, selected-branch-safe real-route drilldowns and U3a guard. These are **not completed by a status screen**. No database migration is authorized to manufacture counters; a future owner must design prospective updates and separately reviewed legacy availability.

**U7 screenshots: E0, none captured.** Request synthetic/redacted proprietor partial scope, no links, revoked branch, suspended branch, module-disabled, unavailable dimensions, invalid period and top-level denial/retry at desktop and **320px**; exercise native keyboard/tab order and long names. jsdom focus/control tests do not prove actual mobile reflow or authenticated runtime. No numeric-dashboard screenshot can be requested as implemented until adapters land.
