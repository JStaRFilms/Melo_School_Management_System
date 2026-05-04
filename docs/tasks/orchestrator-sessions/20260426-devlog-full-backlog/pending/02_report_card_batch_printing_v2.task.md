# Task 02: Report Card Batch Printing v2

## Agent Setup

Do this first:
- Read `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/DevLog_Audit_Ledger.md`.
- Read `docs/features/UnifiedReportCardPrintSystem.md`.
- Read `docs/features/FullClassReportCardPrinting.md`.
- Read `docs/features/ReportCardDocumentationAuthority.md`.
- Read `packages/convex/_generated/ai/guidelines.md` before any Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Coder.
- Initial model: `gpt-5.4`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Escalate implementation to `gpt-5.5` if shared print architecture or teacher/admin routing is unclear.

## Objective

Fix multi-student / full-class report-card printing in admin and teacher portals while preserving the unified print architecture.

## Scope

- Keep `ReportCardSheet`, `ReportCardPreview`, `ReportCardToolbar`, and `ReportCardPrintStack` as the shared print foundation.
- Do not duplicate the print system unless the audit proves there is no safe shared path.
- Fix the admin and teacher `printClass=1` flow so the print stack renders reliably.
- Ensure one report card prints per page.
- Ensure the UI returns to the normal single-student/class view after print or cancel.
- Preserve single-student printing behavior.

## Acceptance Criteria

- Admin can print all report cards for a selected class/session/term.
- Teacher can print only classes they are authorized to access.
- Print stack waits for data before opening print.
- Each student starts on a fresh A4 page.
- Single-student printing still works.
- Relevant report-card docs are updated.
- Targeted typecheck/build and browser print verification are recorded in task notes.
