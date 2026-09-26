# Task 06: Babysit PR and serve all applications

## Agent setup
### Workflow to follow
Takomi finalize with PR babysitting and runtime handoff.
### Prime agent context
Read `AGENTS.md`, master plan, final reports, PR babysitting, GitHub sub-skills, Tailscale serving, and Convex instructions.
### Optional skill and context overlays
Use `convex` and `unslop`.
## Objective
Publish approved corrections, settle current-head checks and comments, activate the confirmed development backend, and expose all seven production-mode apps through Tailscale.
## Scope
Stage exact files, inspect, commit without amending, push, build the feedback ledger, reply to comments, verify checks, confirm development Convex target, deploy once to development, build seven apps, preserve Serve routes, configure tailnet-only HTTPS, restart servers, and smoke-test routes.
## Context
PR #49 stays draft and unmerged. Keep readiness categories separate. Record-creating runtime checks need separate approval.
## Definition of done
- PR head equals reviewed commit.
- Current checks and previews have known states.
- Comments have dispositions.
- Development Convex serves settled functions.
- Seven builds and Tailscale routes work.
- Funnel is off and existing routes remain.
## Expected artifacts
- Commits and PR update if needed
- Feedback ledger
- Readiness report
- Seven Tailscale links
## Constraints
Never merge, rebase, amend, touch Production, enable Funnel, or mutate production data.
## Dependencies
Tasks 03 and 05.
## Verification
Check SHAs, checks, threads, Convex target, builds, Serve JSON, routes, auth endpoints, and processes.
