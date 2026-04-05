# T05 Dev Data Refresh From Production

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Treat this as an operations task, not a feature build.

### Prime Agent Context
Read:

- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
- local Convex config in `.env.local`
- `pnpm exec convex export --help`
- `pnpm exec convex import --help`

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `convex-best-practices` | Deployment safety |
| `convex-security-check` | Prevent destructive mistakes |

## Objective

Replace the current dev deployment data with production data so the development environment reflects real operational stats.

## Scope

Included:

- identify source and target deployments
- obtain or verify the production snapshot source
- validate the import mode before destructive execution
- execute import into dev only after explicit source validation
- verify data shape after import

Excluded:

- any write to production
- schema changes
- code changes not required for migration tooling

## Current Blocker

The repo only exposes the dev deployment locally. Production target information or a production snapshot ZIP is not available yet.

## Definition of Done

- a validated production snapshot exists
- dev deployment target is confirmed
- import plan is executed against dev only
- post-import validation confirms expected tables and representative counts

## Expected Artifacts

- operations note or result file
- exact command log used
- validation summary

## Constraints

- do not wipe dev until the source snapshot is verified
- do not run any destructive command against production
- if production access is not available, stop and request the snapshot or production export help
