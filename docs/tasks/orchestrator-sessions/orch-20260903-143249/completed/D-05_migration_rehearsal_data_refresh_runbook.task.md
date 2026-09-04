# Task D-05: Migration rehearsal data refresh runbook
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Turn migration controls into an operator-ready non-destructive rehearsal and refresh runbook.
## Scope
- Read-only production snapshot protocol
- Verified development backup and restoration
- Manifest count referential and tenant reconciliation
- Development target verification
- MX-01 through MX-15 sequencing and cursors
- Rollback and forward-fix drill templates
## Context
Parent session: orch-20260903-143249

Task title: Migration rehearsal data refresh runbook
## Definition Of Done
- No production mutation command or credentials
- Backup validation and target checks precede refresh
- Expand compatibility backfill verify enforce contract separated
- Operator drill template ready
## Expected Artifacts
- docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md
- Task completion record
## Dependencies
- D-02
## Constraints
- Production remains read-only
- No PII, secrets, snapshots, or destructive commands in Git