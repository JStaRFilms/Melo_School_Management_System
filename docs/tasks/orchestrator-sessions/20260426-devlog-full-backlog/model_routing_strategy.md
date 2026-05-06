# Model Routing Strategy

**Session:** `20260426-devlog-full-backlog`  
**Purpose:** Route Takomi/coding-agent sub-agents to the cheapest capable model while protecting architecture, security, and regression-sensitive work.

## Provider Rule

Use the `oauth-router` provider when dispatching GPT-5.5 / GPT-5.4 / GPT-5.4 Mini subagents unless the user explicitly says otherwise.

Examples:

- `oauth-router/gpt-5.5`
- `oauth-router/gpt-5.4`
- `oauth-router/gpt-5.4-mini`

## Reasoning-Effort Rule

- When the user says **GPT-5.4**, treat that as **GPT-5.4 High**.
- When the user says **GPT-5.4 Mini**, treat that as **GPT-5.4 Mini High**.
- GPT-5.5 may be used at **Low**, **Medium**, or **High** depending on difficulty.

## Available Models

| Model | Mental Model | Use For | Avoid For |
| --- | --- | --- | --- |
| `oauth-router/gpt-5.5` | Senior engineer / architect / reviewer | Complex reasoning, architecture, difficult debugging, regression detection, security review, large refactors, cross-file changes, unclear requirements, inferring missing context | Tiny mechanical edits unless they are part of high-risk review |
| `oauth-router/gpt-5.4` + High | Reliable mid-to-senior workhorse | Normal-to-serious coding, planning plus execution, UI logic, implementation, debugging, reviewing, general execution | Deep uncertainty, final security/regression review when risk is high |
| `oauth-router/gpt-5.4-mini` + High | Fast junior implementer | Small, clear, isolated tasks with detailed instructions: boilerplate, formatting, docs cleanup, renaming, small components, simple tests, basic Tailwind/style changes, applying an already-written plan | Vague tasks, deep debugging, major refactors, architecture decisions, hidden regression checks, security-sensitive changes, anything requiring strong judgment |

## GPT-5.5 Reasoning-Effort Routing

### GPT-5.5 High
Use for:

- major architecture decisions
- security-sensitive logic
- hard debugging
- regression hunting
- cross-file refactors
- unclear or vague tasks
- final deep review

### GPT-5.5 Medium
Use for:

- serious planning
- complex but bounded implementation
- non-trivial debugging
- design/product judgment
- important code review where risk is moderate

### GPT-5.5 Low
Use for:

- execution after the plan is clear
- targeted fixes
- applying known patterns
- straightforward implementation where strong context awareness still matters

## General Rule of Thumb

- Use **GPT-5.5 High or Medium** for uncertain, expensive, risky, or high-judgment planning.
- Use **GPT-5.5 Low** when the task is already well understood but still benefits from senior-level intelligence.
- Use **GPT-5.4 High** for planning plus execution when the task is normal-to-serious but not deeply uncertain.
- Use **GPT-5.4 Mini High** for fast execution when there is a detailed plan and the task is small, isolated, and explicit.

## Role Routing

### Architect
- Use `oauth-router/gpt-5.5` + High for system design, database planning, API structure, security-sensitive decisions, major refactors, unclear project direction, or anything that could affect long-term maintainability.
- Use `oauth-router/gpt-5.5` + Medium for serious but bounded architecture planning.
- Use `oauth-router/gpt-5.4` + High for normal planning and straightforward architecture.
- Avoid GPT-5.4 Mini High for architecture.

### Coder
- Use `oauth-router/gpt-5.4` + High as the default coder.
- Use `oauth-router/gpt-5.5` + High when the code is complex, risky, deeply connected across files, or likely to cause regressions.
- Use `oauth-router/gpt-5.5` + Medium when implementation is complex but the plan is mostly clear.
- Use `oauth-router/gpt-5.5` + Low when the plan is very clear but the task still needs strong contextual awareness.
- Use `oauth-router/gpt-5.4-mini` + High only for small, explicit, isolated coding tasks.

### Designer
- Use `oauth-router/gpt-5.4` + High by default for UI/UX layout, component structure, design systems, and frontend logic.
- Use `oauth-router/gpt-5.5` + Medium or High when the design problem needs deep product thinking, complex interaction logic, UX tradeoffs, or accessibility judgment.
- Use `oauth-router/gpt-5.4-mini` + High for simple style changes, spacing, copy updates, basic Tailwind edits, and clearly defined UI tweaks.

### Reviewer
- Use `oauth-router/gpt-5.5` + High for serious review: regressions, edge cases, security issues, architecture violations, broken assumptions, and deep correctness checks.
- Use `oauth-router/gpt-5.5` + Medium for important review where the scope is bounded.
- Use `oauth-router/gpt-5.4` + High for normal review.
- Use `oauth-router/gpt-5.4-mini` + High only for basic formatting checks, typo checks, or obvious surface-level issues.

## Escalation Rule

Start with the cheapest capable model, but escalate immediately if the task becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, security-sensitive, or regression-sensitive.

## Session Defaults

| Role | Default | Escalate To | Mini Allowed? |
| --- | --- | --- | --- |
| Architect | GPT-5.5 High for serious planning; GPT-5.5 Medium for bounded complex planning; GPT-5.4 High for normal planning | GPT-5.5 High | No |
| Coder | GPT-5.4 High | GPT-5.5 Medium/High depending on risk | Yes, only for simple explicit tasks |
| Designer | GPT-5.4 High | GPT-5.5 Medium/High | Yes, only for small styling tasks |
| Reviewer | GPT-5.5 High for final/deep review; GPT-5.5 Medium for important bounded review; GPT-5.4 High for normal review | GPT-5.5 High | Surface checks only |

## Per-Task Initial Routing

| Task | Primary Role | Initial Model / Effort | Review Model / Effort | Notes |
| --- | --- | --- | --- | --- |
| 01 DevLog Audit Ledger | Reviewer / Architect | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` High | Gatekeeping audit; requires inference, regression mapping, and cross-doc context. |
| 02 Report Card Batch Printing v2 | Coder | `oauth-router/gpt-5.5` High after regression escalation | `oauth-router/gpt-5.5` High | Printing was regression-sensitive; use senior model. |
| 03 School Branding + Parent Multi-School | Architect / Coder | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` High | Security-sensitive tenant context and parent multi-school access. |
| 04 Student Records + Photo Editor | Coder | `oauth-router/gpt-5.5` Medium | `oauth-router/gpt-5.5` High | Storage/auth/report-card surfaces make this complex but bounded. |
| 05 Billing Printable Finance Pack | Coder / Reviewer | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` High | Billing, reconciliation, payment links, and financial correctness are high-risk. |
| 06 Knowledge + Template Prevention Fixes | Coder | `oauth-router/gpt-5.4` High | `oauth-router/gpt-5.5` Medium | Escalate for duplicate-prevention architecture or data integrity issues. |
| 07 Promotions Audit and Fix | Architect / Reviewer | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` High | Academic history and billing/report-card side effects require senior judgment. |
| 08 Portal + Teacher Knowledge Refactors | Coder | `oauth-router/gpt-5.5` Medium | `oauth-router/gpt-5.5` High | Cross-file refactor; preserve behavior. |
| 09 PDF Parser Upgrade | Coder | `oauth-router/gpt-5.4` High | `oauth-router/gpt-5.5` Medium | Escalate if OCR pipeline, async processing, or ingestion contracts need redesign. |
| 10 Study App Discovery Brief | Architect | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` Medium | Product/data-boundary discovery; no code changes. |
| 11 Final Verification, Docs, Deploy | Reviewer / Orchestrator | `oauth-router/gpt-5.5` High | `oauth-router/gpt-5.5` High | Final regression, docs, and deploy gate. |

## Dispatch Template

When spawning a sub-agent, include:

```md
Model routing:
- Provider/model: `oauth-router/<model>`
- Reasoning effort: `<Low|Medium|High>`
- Role: `<architect|coder|designer|reviewer>`
- Escalate to `oauth-router/gpt-5.5` High if scope becomes vague, cross-file risky, security-sensitive, architecture-heavy, debugging-heavy, or regression-sensitive.
- Do not use GPT-5.4 Mini High unless this task is reduced to small, explicit, isolated edits.
```
