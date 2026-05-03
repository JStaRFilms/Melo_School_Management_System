# Task: Root layout toaster integration
**Task ID:** 05
**Stage:** build
**Status:** completed
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
- [x] Read docs/features/unified-toast-system.md
- [x] Inspect all target root layouts before editing
- [x] Add AppToaster to admin layout
- [x] Add AppToaster to teacher layout
- [x] Add AppToaster to platform layout
- [x] Add AppToaster to portal layout
- [x] Confirm exactly one toaster per app
- [x] Run tsc --noEmit after each TS/TSX edit
- [x] Document verification result
## Definition of Done
- Each target app has exactly one AppToaster mounted
- No duplicate toasters are introduced
- Server/client component constraints are respected
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
## Notes
Task 05 completed. Read feature blueprint and inspected all four target layouts. Added @school/shared dependency to apps/platform and ran pnpm install to link workspace dependency. Mounted <AppToaster /> once inside AuthProvider in admin, teacher, platform, and portal root layouts. Verification after each TSX edit: admin typecheck passed; teacher typecheck passed; platform initially failed because @school/shared workspace link was not installed after package.json edit, then pnpm install fixed it and platform typecheck passed; portal typecheck passed. rg confirms exactly one AppToaster mount in each target app.