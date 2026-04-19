# T19 Public Web Operating Modes And Onboarding Policy

## Status

Completed on `2026-04-17`.

## What Changed

1. Added a dedicated feature note at `docs/features/PublicWebOperatingModesAndOnboardingPolicy.md` describing the three supported public-web operating modes.
2. Defined the default onboarding recommendation as Mode B first, with a clean upgrade path to Mode C later.
3. Documented the minimum branded entry points that remain available even when a school keeps its own external website.
4. Clarified the platform-team-managed versus school-managed ownership split so public-web policy stays aligned with the topology note.
5. Updated the orchestrator session docs so T19 is marked complete and the next recommended work stays coherent.

## Files Updated

- `docs/features/PublicWebOperatingModesAndOnboardingPolicy.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T19_public_web_operating_modes_and_onboarding_policy.task.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/completed/T19_public_web_operating_modes_and_onboarding_policy.result.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/master_plan.md`
- `docs/tasks/orchestrator-sessions/orch-20260404-193645-relaunch/Orchestrator_Summary.md`

## Verification Run

- Docs-only change set; no TypeScript files were edited.
- Reviewed against:
  - `docs/Project_Requirements.md`
  - `docs/Coding_Guidelines.md`
  - `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`
  - `docs/features/PlatformSuperAdminFutureBacklog.md`
  - `docs/issues/FR-011.md`
  - the orchestrator session plan and summary files

## Notes

- This work stays strictly separate from the platform marketing site implementation and from the later public-site engine tasks.
- No nested subagents were used.