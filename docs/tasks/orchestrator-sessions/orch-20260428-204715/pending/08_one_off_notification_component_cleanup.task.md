# Task: One-off notification component cleanup
**Task ID:** 08
**Stage:** build
**Status:** pending
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
- [ ] Find all FloatingNotice imports/usages
- [ ] Determine whether behavior maps cleanly to appToast
- [ ] Replace simple usages with appToast if safe
- [ ] Delete FloatingNotice only if unused after replacement
- [ ] If retained, document why it remains specialized
- [ ] Remove dead imports and unused state
- [ ] Run tsc --noEmit after each TS/TSX edit
- [ ] Document verification result
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