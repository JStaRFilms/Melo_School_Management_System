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
