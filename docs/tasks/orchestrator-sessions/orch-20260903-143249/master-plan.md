# Melo School Platform Expansion Program

Session: `orch-20260903-143249`
**Current phase: Design bundle corrected — independent milestone re-review pending.**
**Build-status record:** commits M0–M8 exist in this session; their existence and this correction do not imply release, approval, or a new build authorization. D-01–D-05 are not frozen where their listed legal, provider, runtime, browser, implementation, or operational evidence gates remain open.

## Purpose

Capture the approved H1–H9/F1–F7 decision frontier and turn it into a safe, dependency-aware program without weakening tenant isolation, privacy, financial/document history, or production safety.

## Normative sources and current artifacts

1. [Confirmed product decisions](product-decisions.md) — normative decision ledger; direct interview decisions override older walkthroughs/strategy/mockups.
2. [Implementation program](implementation-program.md) — architecture, invariants, dependency graph, stages, PR gates, rollout/rollback.
3. [Migration verification matrix](migration-verification-matrix.md) — read-only production/development-refresh prerequisite and every data-contract change.
4. [Task packets](task-packets.md) — self-contained Design/Build work packages.
5. [Requirements coverage matrix](requirements-coverage-matrix.md) — H1–H9/F1–F7 traceability and validation gates.
6. [G2 synthesis brief](tasks/G2-program-synthesis.md) — completed synthesis scope.

> Do not edit `master_plan.md`: it is a board-generated mirror preserved by the orchestrator.

## Operating and start gates

- Production remains read-only. Before any production-snapshot-based development refresh: back up and verify development, verify all apps/scripts/functions target development, use established Convex tooling, and do not commit exports, secrets, PII, or sensitive screenshots.
- Named main admin/main teacher credentials may be consulted only from `tmp/demo_school_credentials.md` for authorized verification and must never be reproduced.
- Historical build sequence began at M0 with teacher conditional-hook lint and parallel-timeout root-cause work; its completion is recorded in the task table.
- All migrations use additive expand/compatibility/backfill/verify/enforce/contract sequencing. No monolithic migration.

## Current task table

| ID | Work | State | Dependency / output |
|---|---|---|---|
| G1 | Requirements interview | complete | `product-decisions.md` |
| G2 | Genesis program synthesis | **complete and approved** | Program, matrix, packets, coverage matrix listed above |
| D-01 | Compliance control dossier | **corrected — legal/provider/implementation review pending** | `docs/features/D01_ComplianceControlDossier.md` |
| D-02 | Identity/group/RBAC/audit architecture | **corrected — implementation inventory/security review pending** | `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md` |
| D-03 | Provider/runtime/settlement spikes | **corrected — provider/runtime/finance/legal gates pending** | `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md` |
| D-04 | Cross-app interaction/visual contract | **corrected — route/a11y/content validation pending** | `docs/features/D04_CrossApplicationInteractionAndVisualContract.md` |
| D-05 | Migration rehearsal/data-refresh runbook | **corrected — refresh evidence recorded; restore/migration gates pending** | `docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md` |
| Review | Expansion Design Milestone Review | **prior review superseded — corrected bundle re-review pending** | `docs/features/ExpansionDesignMilestoneReview.md` |
| M0 / PR-A | Baseline quality and environment gate | **commit recorded — no release/approval implied** | Teacher lint clean, parallel timeout root-cause solved (-70% duration) |
| M1 / PR-B | Identity and tenancy kernel | **commit recorded — no release/approval implied** | Canonical persons, branchMemberships, schoolGroups, bridge resolvers, migration runner |
| M2 / PR-C | RBAC and audit kernel | **commit recorded — no release/approval implied** | Role templates, evaluator math, delegation ceilings, append-only redacted audit |
| M3 / PR-D | Group operation/inheritance | **commit recorded — no release/approval implied** | Group operations, branch switcher, dirty-form modal, authoritative 403 screen |
| M4 / PR-E | Grade/admission/bank verticals | **commit recorded — no release/approval implied** | Grade band settings, sequential admission allocator, bank snapshots & masking |
| M5 / PR-F | Theme/draft/progress foundation | **commit recorded — no release/approval implied** | 2-input theme tokens, draft recovery modal, compact mobile progress bar |
| M6 / PR-G | Email/import pipeline | **commit recorded — no release/approval implied** | Zero mail server directory sync, 4-stage collision resolver, AI staging pipeline |
| M7 / PR-H | Commercial/metering/assets | **commit recorded — no release/approval implied** | Core catalog (₦1,000/term+₦30k), quota reservation, quarantine gate, navigable Trash |
| M8 / PR-I | Within-group transfer foundation | **commit recorded — no release/approval implied** | Two-phase commit transfer state machine, privacy boundary, repo-wide verification |
| M9 / later | Melo-to-Melo transfer network | gated later phase | M8, legal/security/provider approvals, new Genesis approval |

## Lifecycle

### Genesis — complete and approved

- [x] Approved interview decisions preserved.
- [x] Dependency-aware program, migration matrix, task packets, and requirements traceability written.
- [x] User approved the synthesized program and authorized Design execution.

### Design — corrected; independent milestone re-review pending

- [x] D-01 corrected to distinguish target controls from legal/provider/implementation evidence and to expand the jurisdiction-source gate.
- [x] D-02 corrected to require an implementation inventory and token-identifier-only migration contract.
- [x] D-03 corrected to gate provider, runtime, AV, settlement, retry, and access-policy claims.
- [x] D-04 corrected with required UI/content/error/accessibility and consumer-route inventories.
- [x] D-05 corrected with supported Convex CLI procedures and recorded non-secret development-refresh evidence.
- [ ] Independent milestone re-review of the corrected D-01–D-05 bundle. The prior approval is superseded; no independent legal approval is claimed.

### Build — commits M0–M8 recorded; release gates remain open

M0–M8 commits are recorded in this human plan. They are not release approval or evidence that external gates passed. Any release or follow-up still requires migration evidence, security/tenant negative tests, relevant a11y/print/provider checks, independent review, and clean reviewable scope.

## Definition of done

- Every H1–H9/F1–F7 requirement is traceable to implementation tasks, milestone, tests, migration, and acceptance evidence.
- Branch/group isolation and authority ceilings are enforced in backend contracts.
- Migrations preserve current access, records, issued documents, and audit/financial history.
- AI remains review-only until deterministic validation and human-approved idempotent commit.
- F4 independent transfers remain a later gated phase after within-group foundations.
