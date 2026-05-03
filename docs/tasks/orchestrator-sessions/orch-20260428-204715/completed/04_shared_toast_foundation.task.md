# Task: Shared toast foundation

**Task ID:** 04
**Stage:** build
**Status:** completed
**Role:** code
**Preferred Agent:** coder
**Conversation ID:** coder-04
**Workflow:** vibe-build
**Model Override:** gpt-5.4

## Context

Parent session: orch-20260428-204715

Task title: Shared toast foundation

## Objective

Implement the shared toast abstraction and utility helpers after design
approval.

## Scope

- Add Sonner dependency if needed
- Create shared AppToaster component
- Create appToast wrapper API
- Create getErrorMessage helper
- Export toast utilities from shared package

## Checklist

- [x] Read docs/Project_Requirements.md and docs/Coding_Guidelines.md before
  coding
- [x] Read docs/features/unified-toast-system.md
- [x] Check whether Sonner is already installed
- [x] Install/add Sonner dependency if needed
- [x] Create shared AppToaster client component
- [x] Create appToast wrapper with success/error/warning/info methods
- [x] Create getErrorMessage helper for unknown errors
- [x] Export toast API from shared package
- [x] Run tsc --noEmit after TypeScript edits
- [x] Document verification result

## Definition of Done

- Shared toast API compiles
- No direct app page migration is included unless needed for smoke test
- Wrapper supports success, error, warning, and info
- Error descriptions are supported

## Expected Artifacts

- packages/shared toast files

## Dependencies

- 02
- 03

## Review Checkpoint

Reviewer checks API shape and client/server boundaries.

## Instructions

- Do not start until Design tasks are approved
- Prefer project wrapper imports over direct Sonner imports in app code
- Keep API stable and small

## Notes

Task 04 completed. Read mandatory docs/Project_Requirements.md,
docs/Coding_Guidelines.md, and docs/features/unified-toast-system.md. Added
sonner to @school/shared. Created
packages/shared/src/toast/{types.ts,defaults.ts,error-message.ts,app-toast.ts,AppToaster.tsx,index.ts}.
Exported toast via @school/shared and @school/shared/toast. Ran pnpm --filter
@school/shared typecheck after every TS/TSX file edit; final typecheck passed.
Direct Sonner imports scan shows only packages/shared/src/toast/AppToaster.tsx
and app-toast.ts.
