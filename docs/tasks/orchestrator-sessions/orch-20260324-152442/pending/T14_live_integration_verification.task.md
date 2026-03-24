# T14 Live Integration Verification

**Mode:** `vibe-review`  
**Workflow:** `/review_code`

## Agent Setup (DO THIS FIRST)

- Read `/review_code`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `nextjs-standards`, and `sync-docs`.
- Do not use `context7`.

## Objective

Run the first real live verification pass for exam recording against authenticated teacher/admin apps and a live Convex deployment.

## Scope

Included:
- authenticated local smoke test for admin settings page
- authenticated local smoke test for grading-band management
- authenticated local smoke test for admin score-entry
- authenticated local smoke test for teacher score-entry
- validation and save-flow checks against live data
- verification notes capturing remaining blockers before production work

Excluded:
- production deployment itself
- new feature work beyond defects required for a passing live test
- broad non-exam QA outside this slice

## Context

Use:
- completed outputs from `T11`, `T12`, and `T13`
- current exam-recording feature docs and task briefs

## Definition Of Done

- The team has a clear yes/no answer on whether exam recording works live end to end.
- Remaining defects, if any, are documented tightly enough to hand off immediately.

## Expected Artifacts

- Verification note/result in the session folder
- Concrete blockers list if live testing fails

## Constraints

- Treat this as a real integration review, not a mock/demo pass.
- Prioritize bugs, contract mismatches, auth failures, and tenant-boundary issues.

## Verification

- Confirm admin can update settings live.
- Confirm admin can update grading bands live.
- Confirm teacher can load and save an assigned sheet live.
- Confirm admin can load and save a school sheet live.
