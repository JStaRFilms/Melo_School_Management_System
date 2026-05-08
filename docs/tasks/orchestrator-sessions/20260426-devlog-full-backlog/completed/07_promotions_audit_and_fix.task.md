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
- Provider/model: `oauth-router/gpt-5.5`.
- Reasoning effort: High.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: High.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
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


## Completion Notes

Status: Completed on 2026-05-08.

Audit answer: promotions were **partially working** before this task. A single-student profile edit could change the active `students.classId`, but there was no selected/bulk promotion workflow, no target-session subject enrollment setup, and no audit trail for class/session movement.

Implemented:
- Added admin-only `studentEnrollment:promoteStudents` mutation for selected active students.
- Added `studentPromotions` audit table with source/target class and session, subject enrollment mode/count, batch key, timestamp, and actor.
- Added `/academic/students` selected-student promotion panel with target class/session and subject-enrollment mode.
- Preserved old `studentSubjectSelections`, `assessmentRecords`, `studentInvoices`, payments, and family/parent links.
- Blocked archived students/users and cross-school source/target records.
- Hardened report-card subject and assessment-record resolution so same-session old/new class selections and records are not mixed.
- Added class URL context to admin/teacher single-student report-card queries, so historical class report cards keep their requested class after promotion.
- Added assessment-record membership to class report-card batch rosters so promoted students remain discoverable for old class/term report cards even without a subject-selection row.
- Validated class URL context against current membership, subject selections, or assessment records before rendering a single-student report card, preventing teachers from forcing unrelated student/class combinations.
- Filtered cumulative historical totals by the resolved report-card class to avoid old/new class leakage after same-session promotion.
- Limited current-class roster seeding to the active session so historical class batches require session evidence from selections or assessment records.
- Passed class context from the teacher report-card workbench to the single report-card query.
- Added `docs/features/StudentPromotionWorkflow.md` and updated academic setup enrollment docs.

Verification:
- `pnpm -C packages/convex exec tsc --noEmit --incremental false --pretty false` PASS
- `pnpm -C apps/admin exec tsc --noEmit --incremental false --pretty false` PASS
- `pnpm -C apps/teacher exec tsc --noEmit --incremental false --pretty false` PASS

Blockers: None.
