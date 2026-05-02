# Task: Toast architecture decision record

**Task ID:** 02
**Stage:** design
**Status:** pending
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
- Define the two-layer architecture: notification system API vs tweakable UI component
- Define toast UX defaults and accessibility expectations
- Define error-message handling policy
- Document migration rules for global errors vs inline validation

## Checklist

- [ ] Inspect package/shared structure and export conventions
- [ ] Inspect root layouts for admin, teacher, platform, portal
- [ ] Confirm Sonner dependency/install approach
- [ ] Define system-layer files: appToast, types, defaults, error-message helper, public exports
- [ ] Define UI-layer files: AppToaster, styling/theming hooks, visual customization boundary
- [ ] Define shared toast API and import path
- [ ] Define UX defaults: position, duration, close, hover behavior, z-index
- [ ] Define error message and privacy policy
- [ ] Define migration rules: toast vs inline validation vs notification center
- [ ] Define ownership options for future agents: separate system/UI agents or single modular implementation
- [ ] Create docs/features/unified-toast-system.md
- [ ] Document acceptance criteria and implementation order

## Definition of Done

- docs/features/unified-toast-system.md exists
- Blueprint includes API, UI component boundary, UX behavior, file targets, non-goals, and acceptance criteria
- Blueprint makes clear that UI styling can be revised by editing the toast component without changing app call sites
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
- Keep app call sites style-free: pages should call the shared API and leave appearance to AppToaster
- Preserve inline validation where it gives field/table-level correction guidance
- Keep toast UI separate from product/domain notification center
