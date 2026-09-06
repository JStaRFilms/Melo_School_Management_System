# U1g — Bounded proprietor operational overview

**Status: locally implemented; runtime/schema rollout and browser evidence remain gated.** The previous null-only status screen has been replaced with genuine enrollment, attendance, finance, staffing and academic summaries. Every source read is indexed and bounded; exceeded bounds, incomplete authority and disabled modules remain unavailable rather than becoming partial totals or zero. No production reads, live Convex/provider commands, deployment, migration, credentials, server or authenticated browser were used.

## API and authority

Public API remains `api.functions.academic.groups.getOperationalOverview({groupId, branchId?, startDate, endDate})`.

- Active canonical recorded proprietor authority is still required for the group. Platform governance and ordinary linked members do not receive group operational access.
- Each active branch independently requires the proprietor's explicit canonical active membership. Per-dimension capability and module checks happen before its source query. Group linkage never authorizes operational reads.
- Active denied/disabled/unavailable branches make the corresponding group total unavailable. Inactive branches are explicitly excluded. A partial sum is never labelled as a group total.
- Optional `branchId` must be an exact link in the group. It is the supported way to retrieve a larger group's bounded branch summary.
- Safe payloads contain branch metadata, aggregates, units/bases/bounds and an optional `/admin/audit` route descriptor. They contain no roster, student identity, admission number, invoice/payment identity, bank details, staff identity or report-card body.

## Metric source and semantics

| Dimension | Server gate | Genuine source and definition | Honest boundary |
|---|---|---|---|
| Enrollment | `enrollment.intakes.manage`; admissions module | Current `students` snapshot joined to same-school student users; unique by user. Excludes archived, graduated, withdrawn, transferred-out, wrong-role/wrong-school and duplicate-user rows. | Current snapshot, not historical period enrollment. More than 500 school student rows returns unavailable. |
| Attendance | `academic.report_cards.preview` | Existing report-card class openings and student times-present records for terms fully contained in the selected UTC period. Latest duplicate key wins; only valid `0 <= present <= opened` pairs contribute. Returns weighted present/opportunity percentage. | Missing/invalid records are excluded and disclosed, never zero. No complete term or denominator is `empty`. Either attendance table over 500 school rows or term directory over 100 is unavailable. Partial-term inference is not attempted. |
| Finance | `finance.reports.view`; billing module | In-period issued school-fee invoices and successful/reconciled applied payments. Returns assessed, collected, current outstanding and waived values separately by currency. | Draft/cancelled invoices; pending/failed/reversed payments; SaaS, provider attempts and settlement ledgers excluded. Invoice and payment windows each cap at 500; no cross-currency scalar total. |
| Staffing | `staff.list.view` | Current nonarchived Admin/Teacher accounts, deduplicated by canonical person then authentication identity. | An account count, not employment/FTE/payroll/attendance. More than 500 school users is unavailable. |
| Academics | `academic.report_cards.preview`; curriculum module | Immutable issued report-card snapshots whose `issuedAt` is in-period. Returns issued report count, distinct students, reports with averages and their weighted mean. Draft assessment rows are excluded. | Publication activity, not a causal cohort trend. Branch grading comparability is not asserted. More than 500 issued reports in-period is unavailable. |

The period remains integer UTC milliseconds, end-exclusive, positive and at most 366 days. Current-snapshot metrics explicitly say they do not use it. At most three branches are source-aggregated in one request to keep the transaction bounded; larger all-branch requests return unavailable dimensions and instruct the user to select a branch. Group totals combine only complete authorized active-branch data. Attendance uses numerator/denominator weighting; academics uses reports-with-average weighting; finance remains split by currency.

## Admin integration and safe branch drilldown

`/admin/group` now shows:

- bounded group totals and branch values with explicit value, state, reason, basis and supporting counts;
- native UTC date and linked-branch filters;
- available, empty, denied, inactive, module-disabled, source-overflow and aggregate-branch-limit states;
- the actual per-request limits (500 source rows/table, 100 terms/branch, three branches/all-branch request);
- one real drilldown only when the branch also has `audit.branch.view`: **Open this branch's scoped audit**.

The drilldown awaits U3a's branch departure guard, activates only a server-listed target through the U1b account-scoped selector, then navigates to the allowlisted explicit-school `/admin/audit` adapter. No enrollment, attendance, finance, staffing or academic legacy route is linked because those caller chains remain default-school scoped. No invented route or relabelled legacy dashboard was added.

## Local verification and self-review

Focused tests now cover known synthetic totals for all five dimensions, archived/departed/duplicate enrollment exclusions, complete-term attendance numerator/denominator, per-currency assessed/collected values, published report averages, period exclusion, denied/inactive/module-disabled branches, no partial group total, Platform/member denial, unrelated branch injection, membership revocation and payload redaction. Admin DOM tests cover numeric/supporting rendering, bounds text, empty/denied states, UTC validation/filter arguments and authorized scoped-audit callback.

Final local rerun: Convex group/access/RBAC bundle **4 files / 28 PASS** (U1f/g suite **7 PASS**); Admin selection/shell/group bundle **4 files / 22 PASS** (overview/default suite **5 PASS**, governance **2 PASS**); Shared workspace policy/navigation **2 files / 19 PASS**. Convex, Shared, Admin, Teacher, Portal and Platform typechecks passed. Focused changed-file ESLint passed with zero warnings; full Admin lint passed with zero errors and 115 pre-existing warnings. `git diff --check` passed with line-ending notices only. The informational theme audit reported only existing tenant-theme fixture colors in touched U1g tests.

Schema changes are additive indexes only: `issuedReportCards.by_school_and_issued_at`, `studentInvoices.by_school_and_issued_at`, and `billingPayments.by_school_and_received_at`. They were authored and tested locally but not deployed.

Self-review confirmed every operational query is behind proprietor + explicit branch membership + dimension authority, uses an index and `.take(limit + 1)`, suppresses overflow values, and emits no raw entity DTO. No counter migration, global identity mutation, provider call, broad Platform bypass or generic settings design was introduced.

## Remaining safe code / external evidence

- Larger-than-bound schools need reviewed maintained aggregate counters or pagination-based materialization before numeric values can be available; current code truthfully withholds them.
- Additional selected-school domain routes remain U1b/domain adapter work; only scoped audit is enabled from this overview.
- Delegated non-proprietor group-summary roles still lack an approved scope contract and remain denied.
- Authorized index/function rollout, authenticated desktop/320px keyboard/browser evidence and screenshots remain U7/runtime gates. U7 itself is blocked by the absent approved account allowlist; that did not block local implementation.
