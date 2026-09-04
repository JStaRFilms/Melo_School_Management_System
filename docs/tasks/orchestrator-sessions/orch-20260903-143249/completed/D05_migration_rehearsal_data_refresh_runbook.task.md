# Task D05: Migration rehearsal and data refresh runbook (all contracts)

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with `docs/tasks/orchestrator-sessions/orch-20260903-143249/migration-verification-matrix.md`, `product-decisions.md`, `task-packets.md` (D-05), `packages/convex/functions/academic/branchSplitV2.ts`, and Convex guidelines.
### Optional Skill / Context Overlays
| Skill | Why |
| --- | --- |
| `convex` | Migration patterns, batching, cursor handling |
| `security-audit` | Non-destructive operator procedures, credential safety |

## Objective
Turn migration matrix controls into an operator-ready, non-destructive rehearsal runbook.

## Scope
- Read-only production snapshot export protocol using established Convex tooling
- Development backup and verification before replacement
- Non-secret manifest & count reconciliation
- Target verification for apps, scripts, and Convex environment
- MX-01 through MX-15 sequencing, cursors, idempotency, and progress tracking
- Rollback and forward-fix decision trees
- Rehearsal drill record template

## Context
Parent session: orch-20260903-143249
Task title: Migration rehearsal and data refresh runbook
Author: Data Migration Architect & Security Systems Operator

## Definition Of Done
- Contains zero production mutation commands or secrets
- Requires verified development backup before replacement
- Covers expand, backfill, verify, enforce, contract stages
- Clear stop conditions and rollback protocol

## Expected Artifacts
- docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md

## Dependencies
- D-02 architecture, migration verification matrix

## Constraints
- Production remains strictly read-only
- No PII, secrets, or snapshots committed to git

## Delivery Record

- **Historical artifact:** The initial D-task document was delivered on 2026-09-03.
- **Current authority:** The corrected feature document and master plan govern review status.
- **Evidence boundary:** This delivery record does not establish legal, provider, runtime, browser/accessibility, migration/restore, security, or release validation.

## Correction status (2026-09-03)

This completion record is superseded for review purposes by the corrected D-01–D-05 feature bundle. The artifact remains delivered, but independent milestone re-review is pending. It does not evidence legal approval, provider/runtime validation, browser/accessibility validation, migration/restore proof, or release authorization.
