# Task R3: Audit result privacy and release authorization

## Agent setup
Follow Takomi review, read `AGENTS.md`, Convex generated guidelines, `docs/tasks/orchestrator-sessions/orch-20260928-083117/{master_plan.md,spec.md,design.md}`, and `git diff origin/master...HEAD` at `99bada7`. Read FR-023 handoff only. No edits.

## Objective
Threat-model all public Convex read/mutation paths and UI release flow for leaking unreleased scores, cross-student/tenant access, wrong historical class, authorization bypass, non-atomic release or orphan exclusions.

## Scope
`resultPublication.ts`, `portal.ts`, schema and reportCards existing clients; audit queries for tenant checks, readiness scans and race conditions; family history/notifications and print. Assess deploy ordering. No parallel worktree edits.

## Definition of done
Evidence-backed high/medium security findings with file:line, exploit or failure case and minimum fix; note no finding if none. Identify test gaps for adversarial cases and distinguish pre-existing issues.

## Expected artifacts
Short security report returned to orchestrator; no file edits.

## Constraints
Read-only. Do not read secret env files, mutate data, commit, push or deploy. Fixed review point is `origin/master` at `23c4880`.

## Dependencies
B1-B4 commit `99bada7`.

## Verification and review checkpoint
Orchestrator triages release-blocking findings and sends corrected scope to coder before PR.
