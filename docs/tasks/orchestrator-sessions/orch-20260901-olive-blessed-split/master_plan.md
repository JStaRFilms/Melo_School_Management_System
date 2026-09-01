# Olive Blessed Academy Production Branch Split and Database Purification

## Goal

Execute the authorized production tenant split and database purification for Olive Blessed Academy while preserving the platform super-admin invariant and proving the final tenant counts, isolation, billing reset, and authentication links.

## Context Intake

- Project requirements reviewed: complete (`docs/project_requirements.md`)
- Feature docs reviewed: complete (`docs/features/OliveBlessedBranchSplitMigration.md`)
- Runtime policy reviewed: complete (`.pi/takomi/model-routing.md`)

## Execution Mode

- Markdown roadbook orchestration with direct Codex implementation because no delegated database operator is available in this session.
- Production mutations are authorized by the mission and run only after the snapshot gate.
- The repository's Convex and Better Auth guidance controls implementation details.

## Tasks

| Task | Status | Notes |
| --- | --- | --- |
| T001 | completed | Snapshot passed: 12,624,855 bytes; required users, storage, and Better Auth archive members verified. |
| T002 | completed | Contracts, bounded purge helpers, John preservation, integrity checks, and local typecheck completed. |
| T003 | completed | Production deploy passed; 51-table duplication gate passed in 103 batch calls. |
| T004 | completed | Class cascades, 17-table AI wipe, school/billing purge, storage cleanup, and pruning completed. |
| T005 | completed | Branch admins reconciled; John preserved in Better Auth/platformAdmins and removed from school users. |
| T006 | completed | Integrity and three local production-backed login smoke tests passed. |

## Verification

- [x] Required docs and production feature protocol reviewed
- [x] Migration implementation locally typechecked/tested
- [x] Production gates completed in order
- [x] Completion summary and feature execution record written
