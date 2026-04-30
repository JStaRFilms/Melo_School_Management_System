# Task: Genesis foundation

**Task ID:** 01
**Stage:** genesis
**Status:** completed
**Role:** orchestrator
**Preferred Agent:** orchestrator
**Conversation ID:** orchestrator-01
**Workflow:** vibe-genesis

## Context

Parent session: orch-20260428-204715

Task title: Genesis foundation

## Objective

Establish the project foundation, produce the required planning docs, and decide what should split next.

## Scope

- Clarify scope and mission
- Create or update the core markdown artifacts
- Lock acceptance criteria and boundaries
- Recommend whether Design and Build should stay compact or expand

## Checklist

- [x] Create or update requirements docs
- [x] Capture acceptance criteria
- [x] Define boundaries and non-goals
- [x] Recommend next-stage task breakdown

## Definition of Done

- Required planning markdown files exist or are updated
- Minimum usable state is explicit
- Genesis recommends the correct next Design and Build structure

## Expected Artifacts

- Requirements and feature docs
- Genesis brief
- Recommended task breakdown for later stages

## Dependencies

- None specified.

## Review Checkpoint

User or orchestrator approves the foundation before expanding later stages.

## Instructions

- treat this as the root task for the whole Genesis -> Design -> Build lifecycle
- create the required markdown artifacts before implementation begins
- split later-stage work only when the scope justifies it
- leave a clear recommendation for how Design and Build should fan out

## Notes

Genesis/discovery plan captured from chat for unified toast notification system.

Goal: Create a unified app-wide toast notification system that replaces scattered local error displays for global feedback and makes errors visible regardless of scroll position across admin, teacher, platform, and portal apps.

Recommended direction: Use a Sonner-based shared toast abstraction rather than direct Sonner imports throughout the app. Create shared exports in packages/shared such as AppToaster, appToast, getErrorMessage, and optional showErrorToast helper. Mount one AppToaster in each app root layout.

UX decisions proposed: Default toast position top-center for visibility; close button available; success/info around 5 seconds; warning around 8 seconds; errors long-lived or persistent depending on severity; hovering should not cause immediate dismissal; support title + description for detailed errors.

Key principle: Toast notifications are separate from existing persistent product/domain notification center. Inline validation should not be blindly removed; field/table validation should remain inline where useful, with toast used to alert users that validation needs attention.

Suggested phases:
1. Discovery audit and decision record.
2. Shared toast foundation.
3. Replace high-impact scattered global error UI.
4. Validation UX review.
5. Deep review and regression pass.

Priority files from user-provided audit include sign-in pages, platform school creation/admin assignment pages, teacher planning pages, grading bands action bar, validation banners, and teacher enrollment FloatingNotice.

Model routing: GPT-5.5 for architecture, validation judgment, and final review; GPT-5.4 for default coding; GPT-5.4 Mini only for small explicit isolated edits. Required preflight before subagent dispatch: run and surface `pi --list-models`.

Recommended next stage: Design, producing docs/features/unified-toast-system.md before implementation.
