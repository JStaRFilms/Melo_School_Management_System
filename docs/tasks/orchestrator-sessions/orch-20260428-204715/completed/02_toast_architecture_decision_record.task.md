# Task: Toast architecture decision record
**Task ID:** 02
**Stage:** design
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-02
**Workflow:** vibe-design
**Model Override:** gpt-5.5
## Context
Parent session: orch-20260428-204715

Task title: Toast architecture decision record
## Objective
Produce the formal unified toast system design blueprint before implementation.
## Scope
- Audit shared package structure and app root layouts
- Decide Sonner wrapper API and export paths
- Define toast UX defaults and accessibility expectations
- Define error-message handling policy
- Document migration rules for global errors vs inline validation
## Checklist
- [x] Inspect package/shared structure and export conventions
- [x] Inspect root layouts for admin, teacher, platform, portal
- [x] Confirm Sonner dependency/install approach
- [x] Define shared toast API and import path
- [x] Define UX defaults: position, duration, close, hover behavior, z-index
- [x] Define error message and privacy policy
- [x] Define migration rules: toast vs inline validation vs notification center
- [x] Create docs/features/unified-toast-system.md
- [x] Document acceptance criteria and implementation order
## Definition of Done
- docs/features/unified-toast-system.md exists
- Blueprint includes API, UX behavior, file targets, non-goals, and acceptance criteria
- Implementation can proceed without revisiting basic architecture
## Expected Artifacts
- docs/features/unified-toast-system.md
## Dependencies
- 01
## Review Checkpoint
Orchestrator/user approves design blueprint before Build tasks begin.
## Instructions
- Do not implement code in this task
- Use top-center as the proposed default unless audit reveals a strong reason not to
- Preserve inline validation where it gives field/table-level correction guidance
- Keep toast UI separate from product/domain notification center
## Notes
Task 02 completed. Created docs/features/unified-toast-system.md with shared package audit, root layout targets, Sonner dependency approach, two-layer system/UI architecture, API/import path, UX defaults, privacy-safe error policy, migration rules, implementation order, non-goals, and acceptance criteria. Noted that apps/platform must add @school/shared before importing AppToaster.