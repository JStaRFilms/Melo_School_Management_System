# T33 Results Entry Services

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-functions` and `convex-realtime`.
- Do not use `context7`.

## Objective

Implement the backend services for draft result entry, review states, publication rules, and reactive updates for score workflows.

## Scope

Included: score-entry mutations, workflow states, publication guards, realtime subscriptions.  
Excluded: final teacher/admin UI.

## Context

This task fulfills `FR-007` and depends on the academic and assessment models.

## Definition of Done

- Score-entry services support draft-to-published transitions.
- Edit rights differ appropriately by role and record state.
- Reactive queries are available for build-out in app surfaces.

## Expected Artifacts

- Convex result-entry functions and subscriptions

## Constraints

- Preserve audit fields for changes.
- Do not allow silent edits to published results.

## Verification

- State transitions and authorization checks are covered by backend tests.

