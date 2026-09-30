# Task B3: integrate issued subject-comment reports into parent portal and print

## Agent setup

Role: coder, vibe-build. CWD: `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress`. Read `AGENTS.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/FR-023.md`, `docs/tasks/orchestrator-sessions/orch-20260928-082626/{master_plan.md,backend-handoff.md,staff-handoff.md,portal-agent-handoff.md,ux_design.md}`. Read `packages/convex/_generated/ai/guidelines.md` before Convex edits. FR-023 current scope overrides old draft designs: one subject-specific teacher comment per student/term, class mode per session. Another agent owns any graded parent visibility change.

## Objective

Keep the standard parent/student portal experience, but show the issued comment report as a tidy subject-name/comment report instead of a graded report. For comment mode with no issued report, show only a neutral "not ready" state. Implement parent and staff A4 report/print safely without exposing drafts to families. Preserve graded report behavior in this branch until integrating the separate graded-parent agent's policy.

## Scope

- Inspect `packages/convex/functions/portal.ts` selected card/history, summary, results, dashboard and notification creation. Extend the typed portal workspace return model with a narrative/report-kind read; enforce the gate in Convex before invoking the live graded builder. For each student/session/term resolve mode by **historical class/session** and issued snapshot first, not today's student.classId. Reuse B1's authorized issued lookup via shared helper, not direct calls to registered public Convex queries. Parent may receive only issued subject IDs/names/order/comments and report context, never drafts or score fallback. For unissued comment-mode terms suppress draft-derived notifications and pending-score data across selected card, history, dashboard/results and report page. Maintain linked family/tenant access.
- Integrate a mode-aware UI in `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx` and `/report-cards`/`/results` as relevant, with a clean list of assigned subject names and per-student comments, not numeric grades/averages/rank. Historical issued copy remains correct after subject rename/promotion. Print the issued report on white A4 paper. Use `@school/shared/theme`, `--school-*-contrast`, readable monochrome, no tenant branding for status/grade. Staff `NarrativeReview` single-student draft print clearly says unpublished; inspect admin and teacher report routes for narrative print and avoid graded batch print for narrative classes. Implement narrative class batch printing if safe/feasible (issued-only by default; staff draft labelled); otherwise explicitly document the remaining gap and prevent wrong-grade print output.
- Write Convex integration tests for portal workspace and parent child/session/term isolation including narrative draft/issued, promoted historical class, results/history/notification suppression. Write UI/print tests for narrative subject comments and unchanged graded mode. Run package typechecks, focused tests, lint, `node scripts/audit-theme-colors.mjs`; classify direct colors. If upstream graded-parent agent branch is available, reconcile `portal.ts` changes deliberately; otherwise leave a precise integration note for PR/rebase. Avoid editing the other agent's worktree.

## Definition of done

In the normal parent portal, a linked parent of a child with comment mode sees only the fixed issued subject-comment report after publication and neutral state before; another family or school cannot access it. No comment-mode scores or drafts appear in selected view, dashboard/results, history, notifications or print. Issued staff and parent print is neat; graded portal/print still functions as in this branch. Tests and typechecks pass or explicit blockers are recorded.

## Expected artifacts

Updated `packages/convex/functions/portal.ts` and focused tests/validators, `apps/portal/app/(portal)/components/portal-workspace/**` and shared report rendering/print components/tests as appropriate, plus `docs/tasks/orchestrator-sessions/orch-20260928-082626/portal-integration.md` with external graded-agent overlap and verification.

## Dependencies and review checkpoint

Depends on B1 and B2. Orchestrator inspects returned portal data for every route and independent reviewer later checks security and integration. Fix any parent draft exposure before PR. Do not claim merged graded-parent policy unless tested on its branch.
