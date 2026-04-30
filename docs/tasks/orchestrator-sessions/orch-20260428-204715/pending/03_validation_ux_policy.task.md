# Task: Validation UX policy

**Task ID:** 03
**Stage:** design
**Status:** pending
**Role:** design
**Preferred Agent:** designer
**Conversation ID:** designer-03
**Workflow:** vibe-design
**Model Override:** gpt-5.5

## Context

Parent session: orch-20260428-204715

Task title: Validation UX policy

## Objective

Define how validation banners, inline errors, and global toast alerts should coexist.

## Scope

- Review known validation-heavy pages
- Classify errors as toast-only, inline-only, or both
- Define user-facing message patterns for validation failure
- Prevent loss of detailed correction guidance

## Checklist

- [ ] Review validation-heavy target pages/components
- [ ] Classify each validation case as inline-only, toast-only, or both
- [ ] Define validation-blocked submit/save toast pattern
- [ ] Define message tone and detail level for validation failures
- [ ] Confirm inline row/field guidance remains where useful
- [ ] Add validation policy to docs/features/unified-toast-system.md
- [ ] List files that need validation-specific implementation treatment

## Definition of Done

- Validation policy is included in docs/features/unified-toast-system.md or a linked section
- Each known validation-heavy target has a proposed treatment
- Rules are clear enough for coders to apply consistently

## Expected Artifacts

- Validation UX section in docs/features/unified-toast-system.md

## Dependencies

- 01

## Review Checkpoint

Orchestrator confirms validation policy before replacement work starts.

## Instructions

- Do not remove inline validation conceptually unless clearly redundant
- Global operation failure should use toast
- Field-specific correction should remain near the field or row
