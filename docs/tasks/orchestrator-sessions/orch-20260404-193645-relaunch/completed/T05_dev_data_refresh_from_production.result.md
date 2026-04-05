# T05 Dev Data Refresh From Production

## Status

Completed on `2026-04-04`.

## What Ran

1. Exported the current dev deployment as a rollback backup with file storage.
2. Exported the default production deployment with file storage.
3. Imported the production snapshot into dev using full replacement.
4. Spot-checked the dev deployment after import.

## Artifacts

- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/artifacts/dev-backup-20260404-193645.zip`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/artifacts/prod-snapshot-20260404-193645.zip`

## Import Summary

The import replaced the existing dev dataset and loaded production snapshot data, including:

- `schools`: 3
- `users`: 59
- `students`: 48
- `classes`: 8
- `subjects`: 26
- `assessmentRecords`: 571

## Validation Notes

- post-import spot checks on `schools`, `users`, and `assessmentRecords` returned live data
- file storage import completed successfully
- the rollback backup remains available on disk if the dev deployment ever needs to be restored
