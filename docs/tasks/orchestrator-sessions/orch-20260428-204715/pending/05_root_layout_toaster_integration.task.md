# Task: Root layout toaster integration

**Task ID:** 05
**Stage:** build
**Status:** pending
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-05
**Workflow:** vibe-build
**Model Override:** gpt-5.4

## Context

Parent session: orch-20260428-204715

Task title: Root layout toaster integration

## Objective

Mount the shared toaster once in each application root layout.

## Scope

- apps/admin/app/layout.tsx
- apps/teacher/app/layout.tsx
- apps/platform/app/layout.tsx
- apps/portal/app/layout.tsx

## Checklist

- [ ] Read docs/features/unified-toast-system.md
- [ ] Inspect all target root layouts before editing
- [ ] Add AppToaster to admin layout
- [ ] Add AppToaster to teacher layout
- [ ] Add AppToaster to platform layout
- [ ] Add AppToaster to portal layout
- [ ] Confirm exactly one toaster per app
- [ ] Confirm layouts import AppToaster from the shared toast package, not from Sonner
- [ ] Confirm no page-level toaster instances are introduced
- [ ] Run tsc --noEmit after each TS/TSX edit
- [ ] Document verification result

## Definition of Done

- Each target app has exactly one AppToaster mounted
- No duplicate toasters are introduced
- Server/client component constraints are respected
- The toaster remains a shared UI component so visual changes stay centralized

## Expected Artifacts

- Updated app root layouts

## Dependencies

- 04

## Review Checkpoint

Reviewer confirms no duplicate providers/toasters and no layout regressions.

## Instructions

- Do not alter unrelated layout structure
- Respect existing providers and ordering
- Ensure toaster appears above app content
- Do not add toast styling or Sonner options directly in app layouts unless the design blueprint explicitly requires a per-app override
