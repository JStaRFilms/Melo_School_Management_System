# Task D-05: Migration Rehearsal and Data Refresh Runbook (All Contracts)

## Objective
Turn migration matrix controls into an operator-ready, non-destructive rehearsal runbook and verified data refresh protocol.

## Scope
- Read-only production snapshot export protocol using established Convex tooling.
- Development database backup and independent restoration validation protocol before any data replacement.
- Manifest, table count, referential integrity, and tenant isolation reconciliation procedures.
- Safe execution environment checks: verify all frontend apps, scripts, Convex functions, and shells strictly target development.
- Migration sequencing, batch cursors, progress tracking, and idempotency across MX-01 through MX-15.
- Rollback and forward-fix decision trees for each migration slice.
- Absolute prohibition on production mutations, credential/PII leaks, snapshot commits, or destructive commands.
- Detailed rehearsal checklists and drill record templates.

## Definition of Done
- Contains zero production mutation commands or credentials.
- Requires verified development backup and app target checks prior to any refresh.
- Explicitly separates expand, compatibility, backfill, verify, enforce, and contract stages.
- Rehearsal drill template ready for operator execution.

## Expected Artifacts
- `docs/features/D05_MigrationRehearsalAndDataRefreshRunbook.md`
- Task completion record

## Dependencies
- D-02 architecture contracts; migration verification matrix

## Constraints
- Production remains strictly read-only.
- No PII, secrets, or database snapshots in git.
