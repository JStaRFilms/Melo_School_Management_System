# Task R1: independently review FR-023 end to end

## Agent setup

Role: reviewer, read-only. CWD `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress`. Read `AGENTS.md`, `docs/issues/FR-023.md`, `docs/tasks/orchestrator-sessions/orch-20260928-082626/{master_plan.md,backend-handoff.md,staff-handoff.md,portal-integration.md,portal-agent-handoff.md}`, and `packages/convex/_generated/ai/guidelines.md` before Convex code. Inspect `git diff origin/master` **and untracked new files** via `git status --short`; do not mistake untracked implementation files for absent code. Read shared admin/teacher/parent routes and exact query return validators.

## Objective

Independently find correctness, data-isolation and release risks before the PR. An enrolled child with five subjects must get five independently drafted teacher comments, issued as one immutable per-term report. Another agent owns a separate graded-parent publication change; do not merge it into this feature without coordination.

## Scope

- Trace mode toggling for classes across sessions and immutable issued locks; draft auth for subject/class/student/session/term and tenant; roster query access, student selections and score write guard. Look for an untrusted teacher/parent accessing another class/subject/student.
- Trace every portal read path selected report, history, dashboard, results, notifications, direct issued query, parent print. Verify no unissued narrative content or graded score fallback leaks, after promotion/subject renaming or switching children. Verify existing graded behavior isn't inadvertently broken by mode dispatch, missing historical class or deep links.
- Audit review-key freshness, empty/missing comments, duplicate publish, snapshot stability, auth/audit and limits/indexes for deploy; specifically check staged index requirements for large tables and tenant purge/seed/copy handling. Check staff/admin UX, 5 subjects/2 students, print label, class batch print gap, keyboard/mobile/contrast and theme audit classification. Reproduce issues with focused commands/tests if practical, but do not change files.

## Definition of done

Return a severity-sorted report with exact file:line evidence and reproduction/fix hints. Separate blocking findings from optional improvements and baseline failures. Name verification commands run and which assertions remain untested. Clear acceptance only if critical flows pass. Write no files. Orchestrator routes blocking fixes to original coder using continuity and re-reviews.

## Expected artifact

Reviewer response with cited findings, verification and PR readiness. Orchestrator records it in `docs/tasks/orchestrator-sessions/orch-20260928-082626/review.md` after review.

## Dependencies and review checkpoint

Depends on B1/B2/B3. This is an independent gate before PR; additional security-focused pass may follow after fixes.
