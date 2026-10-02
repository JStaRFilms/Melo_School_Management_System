# Olive PR review and rollout

## Authorization

The user requests code review, pushing `feature/obhis-website`, opening and babysitting its PR, requesting `@codex review`, copying required existing environment files for local tests, and backend/frontend deployment. They are unavailable and asked for no questions. Foreground agents only. Merge, DNS changes, real-school publication and public domain activation are not authorized.

## Scope and order

1. Review the pending integration and full Olive branch against `origin/master`, pinned at `72a985e430451cbd83627a11a158ec7115d3f097`. Existing implementation specs are `docs/tasks/obhis-production-integration-plan.md`, `docs/features/OBHISLocalHomepageReview.md` and `docs/clients/obhis/OBHISContentApprovalSheet.md`. Preserve all approved original media and placeholders.
2. Copy only required existing ignored local environment files without overwriting anything or printing values. Use mode 0600. Development configuration must not select production implicitly.
3. Run the focused checks and inspect the exact staged diff. Commit owned integration files only, preserving historical commits and the authorized local merge.
4. Push the existing branch, open one PR against master, and explicitly request `@codex review`. Collect checks, reviews, inline threads and issue comments before one consolidated correction pass. Keep optional unrelated changes out of scope. Do not merge.
5. Deploy the reviewed backwards-compatible backend first, using an explicit production selector for the previously owner-confirmed `prod:outgoing-warbler-782` target. Confirm target and run a dry run first. Verify registrations and unauthenticated denial without publishing data.
6. Deploy only the Sites frontend if existing credentials and exact project linkage establish the intended target. Preserve existing hosting secrets, custom-host configuration and public denial. If credentials or target linkage are missing, leave a concrete blocker rather than guess or ask a sleeping user.
7. Push one final preview checkpoint after corrections settle, inspect actual Vercel app checks on the final head, and record the monitoring time. Keep code, review, preview, runtime and release readiness separate.

## Verification and deliverables

Use existing offline locked installs with scripts disabled. Relevant Sites/shared/Convex typechecks, unit/backend/browser tests, Sites build, private-artifact scan, scoped lint and informational theme audit must pass. Record environment-copy paths only, deployment target metadata, safe probe results, PR/comment ledger and precise remaining owner actions in `docs/tasks/obhis-pr-rollout-results.md`. Production runtime checks remain read-only and cannot substitute synthetic image tests for real photo/evidence approval.
