# Task D1: Design graded-result release experience

## Agent setup

### Workflow to follow
Takomi Vibe Design. Design UI/UX only, not backend architecture or implementation.

### Prime agent context
Read `AGENTS.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/master_plan.md`, `docs/tasks/orchestrator-sessions/orch-20260928-083117/spec.md`, `apps/admin/app/assessments/report-cards/components/CertifyReportCard.tsx`, `apps/admin/app/assessments/report-cards/page.tsx`, `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`, and `/Users/toji/Documents/johnsax/Melo_School_Management_System-comment-progress/docs/tasks/orchestrator-sessions/orch-20260928-082626/portal-agent-handoff.md` (read only).

### Optional skill/context overlays
`unslop` for human UI copy. Refer to the repo's school theme rules. Do not load another project's worktree into this one.

## Objective
Write a small, implementable UI contract for Admin readiness/exclusions/class release and family unpublished/released result states that remains compatible with parallel FR-023 narrative work.

## Scope
- Admin selection of class/session/term and readiness roster, certified vs blocked students, admin-only audited exclusion reason, exam-officer release confirmation, frozen-roster warning, release success and repeat/retry state.
- Existing per-student certification copy distinguishing certified from published.
- Portal dashboard, results, report-card/history, notification/print empty and released states; clarify that old published term is not the current term's score.
- Accessibility, responsive behavior, neutral message text and separate narrative placeholders without inventing a narrative API.
- Put only the design in `docs/tasks/orchestrator-sessions/orch-20260928-083117/design.md`.

## Context
Owner chose exam officers can release; only school admins can approve named exclusions; released roster is frozen and historical cards without certifiable policy stay withheld. FR-023 separately owns issued-only narrative parent visibility; both will edit `portal.ts` and portal result types. Do not edit FR-023's worktree.

## Definition of done
- Designer spells out actionable control states, permission/confirmation flows, neutral portal states and exact draft/released copy without implying certification is publication.
- No score-bearing placeholder, wrong-term summary or draft comment leak in family UI.
- Distinct narrative mode integration callout; no narrative implementation or unrelated redesign.
- Includes keyboard/screen-reader/mobile and print behavior plus clear acceptance checks.

## Expected artifacts
`docs/tasks/orchestrator-sessions/orch-20260928-083117/design.md` in the isolated result-publication worktree.

## Dependencies
G1 `spec.md` and owner decisions complete. Design must precede UI implementation, not backend default-deny gate.

## Verification and review checkpoint
Orchestrator checks every screen state against `spec.md`, then gives backend/UI coders the contract. No code edits or commits in this task.
