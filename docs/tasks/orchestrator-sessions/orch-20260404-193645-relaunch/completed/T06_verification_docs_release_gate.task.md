# T06 Verification, Docs, and Release Gate

## Agent Setup (DO THIS FIRST)

### Workflow to Follow
Use review and docs-sync workflows after `T01-T04` are complete.

### Prime Agent Context
Read:

- outputs from `T01-T04`
- `docs/Project_Requirements.md`
- relevant feature docs touched by the cumulative-results slice

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Session alignment |
| `webapp-testing` | Verification coverage |
| `sync-docs` | Documentation correctness |
| `nextjs-standards` | Final checks |

## Objective

Close the cumulative-results slice with actual verification evidence, docs sync, and release-readiness notes.

## Scope

Included:

- typecheck, lint, build, and tests
- targeted manual smoke guidance if full automation is still missing
- feature doc updates
- orchestrator result summary

Excluded:

- new scope outside stabilization or cumulative results

## Definition of Done

- verification status is recorded accurately
- docs match implementation
- remaining risks are explicit and actionable
