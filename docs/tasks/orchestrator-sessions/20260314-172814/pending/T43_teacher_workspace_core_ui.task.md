# T43 Teacher Workspace Core UI

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the core teacher workspace UI for dashboard summaries, lesson planning access, class-subject navigation, and result-entry screens.

## Scope

Included: teacher dashboard, assigned class and subject views, result-entry UI shells.  
Excluded: AI OCR implementation detail screens beyond their entry points if still pending.

## Context

This task is the interface layer for `FR-010` and part of `FR-007`.

## Definition of Done

- Teachers can navigate their assignments quickly.
- The workspace reflects the approved teacher mockups.
- Result-entry flows connect to backend services safely.

## Expected Artifacts

- teacher routes and components in `apps/teacher`

## Constraints

- Optimize for mobile-first task completion.
- Show only assigned data.

## Verification

- Teachers can reach core workflows without seeing unauthorized classes or subjects.

