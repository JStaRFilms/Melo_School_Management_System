# Model Routing Strategy

**Session:** `20260426-devlog-full-backlog`  
**Purpose:** Route Takomi/coding-agent sub-agents to the cheapest capable model while protecting architecture, security, and regression-sensitive work.

## Available Models

| Model | Routing Intent | Use For | Avoid For |
| --- | --- | --- | --- |
| `gpt-5.5` | Senior brain | Complex reasoning, architecture decisions, difficult debugging, regression detection, security review, large refactors, cross-file changes, inferring missing context | Small mechanical edits unless bundled into a high-risk review |
| `gpt-5.4` | Default workhorse | Normal coding, planning, UI logic, implementation, debugging, reviewing, general execution | Final security/regression review when risk is high |
| `gpt-5.4-mini` | Fast junior implementer | Small, clear, isolated tasks with detailed instructions: boilerplate, formatting, docs cleanup, renaming, small components, simple tests | Vague tasks, deep debugging, major refactors, architecture decisions, hidden regression checks, anything requiring strong judgment |

## Role Routing

### Architect
- Use `gpt-5.5` for system design, database planning, API structure, security-sensitive decisions, major refactors, or unclear project direction.
- Use `gpt-5.4` for normal planning and straightforward architecture.
- Do not use `gpt-5.4-mini` for architecture.

### Coder
- Use `gpt-5.4` as the default coder.
- Use `gpt-5.5` when the code is complex, risky, deeply connected across files, or likely to cause regressions.
- Use `gpt-5.4-mini` only for small, explicit, isolated coding tasks.

### Designer
- Use `gpt-5.4` by default for UI/UX layout, component structure, design systems, and frontend logic.
- Use `gpt-5.5` when the design problem needs deep product thinking or complex interaction logic.
- Use `gpt-5.4-mini` for simple style changes, spacing, copy updates, basic Tailwind edits, and clearly defined UI tweaks.

### Reviewer
- Use `gpt-5.5` for serious review: regressions, edge cases, security issues, architecture violations, broken assumptions, and deep correctness checks.
- Use `gpt-5.4` for normal review.
- Use `gpt-5.4-mini` only for basic formatting checks, typo checks, or obvious surface-level issues.

## Escalation Rule

Start with the cheapest capable model, but escalate immediately if the task becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, or regression-sensitive.

## Session Defaults

| Role | Default | Escalate To | Mini Allowed? |
| --- | --- | --- | --- |
| Architect | `gpt-5.5` for serious planning; `gpt-5.4` for normal planning | `gpt-5.5` | No |
| Coder | `gpt-5.4` | `gpt-5.5` | Yes, only for simple explicit tasks |
| Designer | `gpt-5.4` | `gpt-5.5` | Yes, only for small styling tasks |
| Reviewer | `gpt-5.5` for final/deep review; `gpt-5.4` for normal review | `gpt-5.5` | Surface checks only |

## Per-Task Initial Routing

| Task | Primary Role | Initial Model | Review Model | Notes |
| --- | --- | --- | --- | --- |
| 01 DevLog Audit Ledger | Reviewer / Architect | `gpt-5.5` | `gpt-5.5` | Gatekeeping audit; requires inference, regression mapping, and cross-doc context. |
| 02 Report Card Batch Printing v2 | Coder | `gpt-5.4` | `gpt-5.5` | Escalate implementation to `gpt-5.5` if shared print architecture or teacher/admin routing is unclear. |
| 03 School Branding + Parent Multi-School | Architect / Coder | `gpt-5.5` | `gpt-5.5` | Security-sensitive tenant context and parent multi-school access. |
| 04 Student Records + Photo Editor | Coder | `gpt-5.4` | `gpt-5.5` | Escalate if storage/auth boundaries or report-card integration become risky. |
| 05 Billing Printable Finance Pack | Coder / Reviewer | `gpt-5.5` | `gpt-5.5` | Billing, reconciliation, payment links, and financial correctness are high-risk. |
| 06 Knowledge + Template Prevention Fixes | Coder | `gpt-5.4` | `gpt-5.5` | Escalate for duplicate-prevention architecture or data integrity issues. |
| 07 Promotions Audit and Fix | Architect / Reviewer | `gpt-5.5` | `gpt-5.5` | Academic history and billing/report-card side effects require senior judgment. |
| 08 Portal + Teacher Knowledge Refactors | Coder | `gpt-5.4` | `gpt-5.5` | Refactor is cross-file; escalate if behavior preservation is hard to prove. |
| 09 PDF Parser Upgrade | Coder | `gpt-5.4` | `gpt-5.5` | Escalate if OCR pipeline, async processing, or ingestion contracts need redesign. |
| 10 Study App Discovery Brief | Architect | `gpt-5.5` | `gpt-5.4` | Product/data-boundary discovery; no code changes. |
| 11 Final Verification, Docs, Deploy | Reviewer / Orchestrator | `gpt-5.5` | `gpt-5.5` | Final regression, docs, and deploy gate. |

## Dispatch Template

When spawning a sub-agent, include:

```md
Model routing:
- Initial model: `<model>`
- Role: `<architect|coder|designer|reviewer>`
- Escalate to `gpt-5.5` if scope becomes vague, cross-file risky, security-sensitive, architecture-heavy, debugging-heavy, or regression-sensitive.
- Do not use `gpt-5.4-mini` unless this task is reduced to small, explicit, isolated edits.
```
