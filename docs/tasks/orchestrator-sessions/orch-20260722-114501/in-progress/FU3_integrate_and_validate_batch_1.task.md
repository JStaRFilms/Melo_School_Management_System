# FU3 — Batch 1 integration checkpoint and manual-test handoff

**Session:** `orch-20260722-114501`  
**Stage:** Build follow-up | **Role:** Orchestrator | **Depends on:** FU1, FU2 | **Worktree:** integration owner checkout

## Objective

Review the complete Batch 1 feature diff once, integrate it into `integration/obhis-admissions-release`, run proportional release checks, and update the existing session artifacts without touching `master`.

## Scope

- Confirm FU1/FU2 completed in a fresh feature worktree created from the current integration HEAD.
- Review the integrated behavior and diff for the evidence-backed root cause, serialized writes, local recovery safety, section-scoped errors, and current-section progression.
- Confirm Batch 2 and Batch 3 remain unimplemented and documented as pending.
- Run focused tests/type checks first, then only broader Apply/Convex checks justified by changed files, plus `git diff --check`.
- Merge the reviewed feature branch into `integration/obhis-admissions-release` through the integration-owner checkout.
- Do not merge or push to `master`.
- Update the existing Takomi board/session notes and future-work document with Batch 1 implementation status and user-owned browser verification cases.

## Security and regression checkpoint

Verify from code/tests that:

- guardian ownership and school scope remain server-derived;
- expected-version conflicts remain fail-closed and cannot overwrite newer edits;
- submitted snapshots and locked applications remain immutable;
- local recovery is scoped to the application and contains no documents, secrets, auth tokens, or payment data;
- deterministic invalid data is not retried in a loop;
- stale section errors are not presented as the active section failure.

## Definition of done

- The complete feature diff is reviewed at this integrated milestone and is merge-ready.
- Required automated checks pass; any real limitation is recorded rather than waived.
- The feature commit is merged into `integration/obhis-admissions-release`; `master` remains untouched.
- Session artifacts record Batch 1 completion or the exact unresolved blocker.
- The user receives concise manual cases for refresh/restart, offline/reconnect, navigation, field focus/errors, and multi-tab conflict behavior.

## Expected artifacts

- Integration commit on `integration/obhis-admissions-release`.
- Updated `Orchestrator_Summary.md` and Batch 1 status in `future/Admissions_Application_Future_UX_and_Data_Safety_Work.md` if validation passes.
- `docs/tasks/orchestrator-sessions/orch-20260722-114501/follow-up/FU3_batch1_integration_report.md`.

## Review policy

FU3 is the appropriate integrated checkpoint. Do not automatically dispatch a separate reviewer; the integration owner performs this checkpoint unless the user explicitly requests an independent milestone review.
