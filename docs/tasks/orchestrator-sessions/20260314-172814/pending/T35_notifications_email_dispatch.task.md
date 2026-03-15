# T35 Notifications and Email Dispatch

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `convex-http-actions` and `convex-cron-jobs`.
- Do not use `context7`.

## Objective

Implement notification dispatch and scheduling for onboarding, report publication, invoice events, and payment events.

## Scope

Included: event triggers, dispatch adapters, retry-safe background jobs, message status handling.  
Excluded: copywriting for the templates themselves.

## Context

This task operationalizes `FR-012` after templates and core domain events exist.

## Definition of Done

- Notification triggers exist for key academic and billing events.
- Background delivery paths are idempotent.
- Delivery status can be inspected later.

## Expected Artifacts

- Convex actions or scheduled jobs for dispatch
- supporting message-status data structures

## Constraints

- Keep provider coupling behind adapters.
- Avoid duplicate sends on retry paths.

## Verification

- Test or simulate result and payment notification flows end to end.

