# B4: Verify selectable billing integration

## Agent setup

Follow Vibe Build. Read every prior result in this session and inspect the complete branch diff before changing anything.

## Objective

Run the full focused verification matrix across Convex, Admin, and Parent Portal. Repair only confirmed integration defects caused by this feature.

## Scope

- Backend selectable billing tests and existing billing regressions
- Convex code generation and typecheck
- Focused Admin and Portal tests
- Admin and Portal typechecks and production builds
- School-facing theme color audit
- End-to-end contract consistency for totals, revisions, payment locks, and payment-link amounts

## Constraints

- Do not broaden into unrelated lint, architecture, or UI cleanup.
- Preserve all shared-worktree changes.
- Do not deploy.
- Do not change valid tests to hide incorrect behavior.

## Definition of done

- All required checks pass, or a real blocker is recorded with exact output and the task remains blocked.
- No unselected optional item contributes to persisted outstanding totals.
- No selection mutation succeeds after payment.
- Admin and Parent clients call the exact generated contracts.
- The branch diff contains only feature and session artifacts.

## Expected artifact

Write `docs/tasks/orchestrator-sessions/orch-20260914-073210/B4-integration.result.md` with commands, results, fixes, and remaining risks.

## Verification checkpoint

The orchestrator sends the verified diff to R1 for one independent review pass.
