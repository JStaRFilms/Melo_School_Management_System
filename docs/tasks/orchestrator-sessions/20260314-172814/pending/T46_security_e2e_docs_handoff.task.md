# T46 Security, E2E, Docs Sync, and Final Handoff

**Mode:** `vibe-review`  
**Workflow:** `/vibe-finalize`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-finalize` and `/review_code`.
- Run `/vibe-primeAgent`.
- Load `security-audit`, `convex-security-audit`, `jstar-reviewer`, `webapp-testing`, `sync-docs`, and `crafting-effective-readmes`.
- Do not use `context7`.

## Objective

Run the final hardening loop: security review, review/audit passes, Cypress critical-path validation, docs synchronization, and release handoff.

## Scope

Included: security audit, J-Star review loop, E2E verification, docs updates, final report generation.  
Excluded: new feature scope unless required to fix a release-blocking defect.

## Context

This task is the final gate and may only run after the major implementation tasks are complete.

## Definition of Done

- Security findings are resolved or explicitly documented.
- Critical-path E2E flows pass.
- Docs and handoff reports are current.
- The repo is ready for a release-quality handoff.

## Expected Artifacts

- updated `docs/features/*`
- review or audit outputs
- final handoff report
- updated `Orchestrator_Summary.md`

## Constraints

- Do not add new product scope during hardening.
- Keep fixes targeted to release blockers and material defects.

## Verification

- Run the full verification stack and record the outcomes.
- Ensure docs reflect the actual implementation, not the intended one.

