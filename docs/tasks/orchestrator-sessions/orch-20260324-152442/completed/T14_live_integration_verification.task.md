# T14 Live Integration Verification

**Mode:** `vibe-review`  
**Workflow:** `/review_code`

## Agent Setup

- Read `/review_code`.
- Run `/vibe-primeAgent`.
- Load `takomi`, `nextjs-standards`, `sync-docs`, and `webapp-testing`.
- Do not use `context7`.

## Objective

Run the first real live verification pass for exam recording against authenticated teacher/admin apps and a live Convex deployment.

## Scope

Included:
- authenticated local smoke test for the admin settings page
- authenticated local smoke test for grading-band management
- authenticated local smoke test for admin score-entry
- authenticated local smoke test for teacher score-entry
- validation and save-flow checks against live data
- verification notes capturing any remaining blockers before production work

Excluded:
- production deployment itself
- new feature work beyond defects required for a passing live test
- broad non-exam QA outside this slice

## Context

Use:
- completed outputs from `T11`, `T12`, and `T13`
- current exam-recording feature docs and task briefs
- seeded demo credentials from `T13`

## Definition Of Done

- [x] The team has a clear yes/no answer on whether exam recording works live end to end.
- [x] Remaining defects, if any, are documented tightly enough to hand off immediately.

## Expected Artifacts

- [x] Verification note/result in the session folder
- [x] Concrete blockers list if live testing fails
- [x] Reproducible live smoke script for the verified flow

## Constraints

- [x] Treat this as a real integration review, not a mock/demo pass.
- [x] Prioritize bugs, contract mismatches, auth failures, and tenant-boundary issues.

## Verification

- [x] Confirm admin can update settings live.
- [x] Confirm admin can update grading bands live.
- [x] Confirm teacher can load and save an assigned sheet live.
- [x] Confirm admin can load and save a school sheet live.

## Verified Live Command

```bash
python C:\Users\johno\.codex\skills\webapp-testing\scripts\with_server.py ^
  --server "pnpm --filter @school/admin dev" --port 3002 ^
  --server "pnpm --filter @school/teacher dev" --port 3001 ^
  -- python scripts\test_live_exam_recording.py
```
