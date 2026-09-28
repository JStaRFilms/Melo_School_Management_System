# Handoff to the graded parent-visibility agent

This worktree adds FR-023, per-subject comment reports for selected classes per session. Reports remain term-specific. Another agent owns any change to **existing graded-report** parent publication rules. Please do not take that graded work into this PR.

Current baseline `packages/convex/functions/portal.ts:getWorkspaceData` calls `tryBuildStudentReportCard`, which can expose live uncertified graded results to linked portal users. The other agent may change this. FR-023 requires a separate server-side gate: for a narrative class-term the parent receives **only an explicitly issued narrative snapshot**, never draft observations, comments, descriptive scales, pending-score notifications, or a fallback live graded card. Resolve historical reports by issued student/session/term/class data, not only the student's current class.

Shared integration hotspot: `packages/convex/functions/portal.ts` and its portal result validators, history, selected report and notification code. Both agents should avoid editing each other's worktree or cherry-picking the whole file. Rebase FR-023 onto the graded agent's merged changes if they land first, or reconcile both patches line by line at PR integration. Test both cases together: unpublished graded visibility according to the graded agent's final contract, and unpublished narrative never visible under any policy. Also test a published report after a class switch/promotion and cross-family/cross-school isolation.

FR-023 scope and design: `docs/issues/FR-023.md` and `docs/tasks/orchestrator-sessions/orch-20260928-082626/design-contract.md` in this branch. Coordinate via PR comments or the orchestrator before changing portal's shared read model.
