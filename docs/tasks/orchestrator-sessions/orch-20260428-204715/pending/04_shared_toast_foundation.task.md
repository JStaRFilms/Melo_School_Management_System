# Task: Shared toast foundation

**Task ID:** 04
**Stage:** build
**Status:** pending
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-04
**Workflow:** vibe-build
**Model Override:** gpt-5.4

## Context

Parent session: orch-20260428-204715

Task title: Shared toast foundation

## Objective

Implement the shared toast abstraction and utility helpers after design approval.

## Scope

- Add Sonner dependency if needed
- Create system-layer appToast wrapper API
- Create system-layer toast types/defaults
- Create getErrorMessage helper
- Create UI-layer AppToaster component
- Export toast utilities from shared package

## Checklist

- [ ] Read docs/Project_Requirements.md and docs/Coding_Guidelines.md before coding
- [ ] Read docs/features/unified-toast-system.md
- [ ] Check whether Sonner is already installed
- [ ] Install/add Sonner dependency if needed
- [ ] Create system-layer toast types and option types
- [ ] Create system-layer default durations/positions/severity behavior
- [ ] Create appToast wrapper with success/error/warning/info methods
- [ ] Create getErrorMessage helper for unknown errors
- [ ] Create shared AppToaster client component as the only visual/styling surface
- [ ] Confirm appToast call sites will not need styling props for normal usage
- [ ] Export toast API from shared package
- [ ] Run tsc --noEmit after TypeScript edits
- [ ] Document verification result

## Definition of Done

- Shared toast API compiles
- No direct app page migration is included unless needed for smoke test
- Wrapper supports success, error, warning, and info
- Error descriptions are supported
- System layer and UI layer are separate enough that AppToaster styling can change later without changing app call sites

## Expected Artifacts

- packages/shared toast system files
- packages/shared toast UI component

## Dependencies

- 02
- 03

## Review Checkpoint

Reviewer checks API shape and client/server boundaries.

## Instructions

- Do not start until Design tasks are approved
- Prefer project wrapper imports over direct Sonner imports in app code
- Keep API stable and small
- Keep UI customization centralized in AppToaster or adjacent toast UI helpers
- If this task is split across agents, the system-layer agent owns appToast/types/defaults/error-message/index exports, and the UI-layer agent owns AppToaster/styling only
