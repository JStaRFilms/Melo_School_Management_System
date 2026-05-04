# Task 07: Promotions Audit and Fix

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read academic/session/class/student feature docs relevant to enrollment and promotion.
- Inspect Convex academic functions for promotion or class movement behavior.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build` only if audit finds a gap.

Use these skills where available:
- `takomi`
- `convex`
- `convex-security-check`
- `nextjs-standards`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Architect / Reviewer.
- Initial model: `gpt-5.5`.
- Review model: `gpt-5.5`.
- Escalation: move to `gpt-5.5` immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- `gpt-5.4-mini` is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Academic history and billing/report-card side effects require senior judgment.

## Objective

Confirm whether student promotions between classes/sessions work, and implement the smallest safe fix if they do not.

## Scope

- Audit current class/session movement behavior.
- Verify what happens to subject enrollment, report cards, invoices, parent links, and archived students.
- If missing or broken, add a safe promotion workflow for moving selected students from one class/session context to another.
- Preserve historical academic records.
- Do not mutate old report cards or invoices unless explicitly required and documented.

## Acceptance Criteria

- Clear answer: promotions work, partially work, or are missing.
- If implemented, admins can promote selected students safely.
- Historical records remain tied to their original session/term/class.
- New class enrollment is school-scoped and auditable.
- Docs and verification notes are updated.
