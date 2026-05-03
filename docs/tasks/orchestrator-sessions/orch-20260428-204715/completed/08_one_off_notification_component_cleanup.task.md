# Task: One-off notification component cleanup
**Task ID:** 08
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-08
**Workflow:** vibe-build
**Model Override:** gpt-5.4
**Model Hint:** Requested model 'GPT-5.4 Mini' was unavailable; using 'gpt-5.4' instead.
## Context
Parent session: orch-20260428-204715

Task title: One-off notification component cleanup
## Objective
Remove or adapt localized toast-like components after the shared system is in place.
## Scope
- apps/teacher/app/enrollment/subjects/components/FloatingNotice.tsx
- Any direct usages of FloatingNotice found during audit
## Checklist
- [x] Find all FloatingNotice imports/usages
- [x] Determine whether behavior maps cleanly to appToast
- [x] Replace simple usages with appToast if safe
- [x] Delete FloatingNotice only if unused after replacement
- [x] If retained, document why it remains specialized
- [x] Remove dead imports and unused state
- [x] Run tsc --noEmit after each TS/TSX edit
- [x] Document verification result
## Definition of Done
- FloatingNotice is replaced, removed, or explicitly retained with justification
- No dead imports remain
- Behavior remains equivalent or better
## Expected Artifacts
- Updated or deleted FloatingNotice-related files
## Dependencies
- 04
- 05
- 06
## Review Checkpoint
Reviewer confirms cleanup is safe and not over-broad.
## Instructions
- This is suitable for GPT-5.4 Mini only if usages are simple and explicit
- Escalate to GPT-5.4 if behavior is unclear
- Do not remove specialized UX without confirming replacement behavior
## Notes
Task 08 completed directly. Found only FloatingNotice usage in teacher enrollment subjects page. Behavior mapped cleanly to appToast because it was an ephemeral fixed success/error notice. Replaced with appToast.success/error using stable per-student IDs, deleted FloatingNotice component, removed unused EnrollmentNotice type, and removed dead local notice state/effect/imports. Verification: pnpm --filter @school/teacher typecheck passed after edits; scan shows no FloatingNotice/EnrollmentNotice/getUserFacingErrorMessage remains in the feature.