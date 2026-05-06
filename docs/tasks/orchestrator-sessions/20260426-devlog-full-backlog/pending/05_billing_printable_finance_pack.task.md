# Task 05: Billing Printable Finance Pack

## Agent Setup

Do this first:
- Read `DevLog_Audit_Ledger.md`.
- Read `docs/features/BillingAndPaymentsFoundation.md`.
- Read `docs/features/Billing_Redesign.md`.
- Read `docs/features/BillingReferenceResolutionHardening.md`.
- Read `packages/convex/_generated/ai/guidelines.md` before Convex edits.
- Prime with Takomi `vibe-primeAgent`; implement with `vibe-build`.

Use these skills where available:
- `takomi`
- `convex`
- `convex-security-check`
- `nextjs-standards`
- `frontend-design`
- `webapp-testing`
- `sync-docs`


## Model Routing

- Strategy source: `docs/tasks/orchestrator-sessions/20260426-devlog-full-backlog/model_routing_strategy.md`.
- Primary role: Coder / Reviewer.
- Provider/model: `oauth-router/gpt-5.5`.
- Reasoning effort: High.
- Review provider/model: `oauth-router/gpt-5.5`.
- Review reasoning effort: High.
- Escalation: move to `oauth-router/gpt-5.5` High immediately if work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.
- GPT-5.4 Mini High is allowed only for small, explicit, isolated subtasks carved out from this task.
- Task note: Billing, reconciliation, payment links, and financial correctness are high-risk.

## Objective

Give schools a clean way to view and print invoices and payment statements with payment links, QR codes, and payment date/time visibility.

## Scope

- Add invoice print/view surface for a selected student invoice.
- Include payment URL and QR code in UI and printed invoice.
- Add printable statement view showing charges, payments, dates/times, balance, and invoice references.
- Keep payment provider logic provider-agnostic and Paystack-first.
- Preserve manual and online payment reconciliation rules.

## Acceptance Criteria

- Admin can open and print a student invoice with QR/payment link.
- Admin can open and print a student statement.
- Payment date/time is visible in the billing UI.
- Statement totals match invoice/payment data.
- No cross-school billing data can appear.
- Billing docs are updated and verification is recorded.
