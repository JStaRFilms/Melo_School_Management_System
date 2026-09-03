# Melo School Platform Expansion Program

Session: `orch-20260903-143249`
**Current phase: Design complete & approved — Build Phase 2 authorized.**
**Build status: Milestone M0 / PR-A ready to begin.** PR #21 is merged, branch `feat/melo-expansion-design` verified, and all D-01–D-05 contracts are frozen.

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
- First implementation work is M0: fix teacher conditional-hook lint blockers and investigate the parallel-only `foundationContracts.test.ts` timeout. Do not merely increase timeout without root-cause work.
- All migrations use additive expand/compatibility/backfill/verify/enforce/contract sequencing. No monolithic migration.

## Current task table

| ID | Work | State | Dependency / output |
|---|---|---|---|
| G1 | Requirements interview | complete | `product-decisions.md` |
| G2 | Genesis program synthesis | **complete and approved** | Program, matrix, packets, coverage matrix listed above |
| D-01 | Compliance control dossier | **complete** | `docs/features/D01_ComplianceControlDossier.md` |
| D-02 | Identity/group/RBAC/audit architecture | **complete** | `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md` |
| D-03 | Provider/runtime/settlement spikes | **complete** | `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md` |
| D-04 | Cross-app interaction/visual contract | **complete** | `docs/features/D04_CrossApplicationInteractionAndVisualContract.md` |
| D-05 | Migration rehearsal/data-refresh runbook | **complete** | `docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md` |
| Review | Expansion Design Milestone Review | **complete & approved** | `docs/features/ExpansionDesignMilestoneReview.md` |
| M0 / PR-A | Baseline quality and environment gate | **complete** | Teacher lint clean, parallel timeout root-cause solved (-70% duration) |
| M1 / PR-B | Identity and tenancy kernel | **complete** | Canonical persons, branchMemberships, schoolGroups, bridge resolvers, migration runner |
| M2 / PR-C | RBAC and audit kernel | **complete** | Role templates, evaluator math, delegation ceilings, append-only redacted audit |
| M3 / PR-D | Group operation/inheritance | **complete** | Group operations, branch switcher, dirty-form modal, authoritative 403 screen |
| M4 / PR-E | Grade/admission/bank verticals | **complete** | Grade band settings, sequential admission allocator, bank snapshots & masking |
| M5 / PR-F | Theme/draft/progress foundation | ready to begin | M2/M3, D-04 |
| M6 / PR-G | Email/import pipeline | ready to begin | M1/M2/M4, D-01/D-03/D-04 |
| M7 / PR-H | Commercial/metering/assets | blocked on M2/M3 | M2/M3, D-01/D-03/D-04 |
| M8 / PR-I | Within-group transfer foundation | blocked on M1–M4 | M1–M4, D-01/D-03 |
| M9 / later | Melo-to-Melo transfer network | gated later phase | M8, legal/security/provider approvals, new Genesis approval |

## Lifecycle

### Genesis — complete and approved

- [x] Approved interview decisions preserved.
- [x] Dependency-aware program, migration matrix, task packets, and requirements traceability written.
- [x] User approved the synthesized program and authorized Design execution.

### Design — complete and approved

- [x] D-01 Compliance control dossier completed (`docs/features/D01_ComplianceControlDossier.md`).
- [x] D-02 Identity, group, RBAC, and audit architecture completed (`docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md`).
- [x] D-03 Provider, runtime, and settlement spikes completed (`docs/features/D03_ProviderRuntimeAndSettlementSpikes.md`).
- [x] D-04 Cross-application interaction and visual contract completed (`docs/features/D04_CrossApplicationInteractionAndVisualContract.md`).
- [x] D-05 Migration rehearsal and data refresh runbook completed (`docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md`).
- [x] Independent Milestone Review completed with unconditional approval for Build handoff (`docs/features/ExpansionDesignMilestoneReview.md`).

### Build — ready to begin

Milestone-sized PRs begin at M0 and use integration reviews at M0–M8. Every release gate requires migration evidence, security/tenant negative tests, relevant a11y/print/provider checks, and clean reviewable scope.

## Definition of done

- Every H1–H9/F1–F7 requirement is traceable to implementation tasks, milestone, tests, migration, and acceptance evidence.
- Branch/group isolation and authority ceilings are enforced in backend contracts.
- Migrations preserve current access, records, issued documents, and audit/financial history.
- AI remains review-only until deterministic validation and human-approved idempotent commit.
- F4 independent transfers remain a later gated phase after within-group foundations.
