# Coding Agent Sub-Agent Model Routing Strategy

Provider: `oauth-router`

## Available Models

### GPT-5.5
Use as the senior brain for complex reasoning, architecture decisions, difficult debugging, regression detection, security review, large refactors, cross-file changes, and tasks where missing context must be inferred.

### GPT-5.4
Use as the default workhorse for normal coding, planning, UI logic, implementation, debugging, reviewing, and general execution.

### GPT-5.4 Mini
Use as the fast execution model for small, clear, isolated tasks where instructions are already detailed: simple edits, boilerplate, formatting, small components, simple tests, docs cleanup, renaming, and repetitive implementation.

Do not use GPT-5.4 Mini for vague tasks, deep debugging, major refactors, architecture decisions, hidden regression checks, or anything requiring strong judgment.

## Role Routing

| Role | Default | Escalate To | Mini Allowed For |
| --- | --- | --- | --- |
| Architect | GPT-5.5 for serious planning; GPT-5.4 for normal planning | GPT-5.5 | Avoid mini for architecture |
| Coder | GPT-5.4 | GPT-5.5 for complex/risky/cross-file work | Small explicit isolated coding tasks |
| Designer | GPT-5.4 | GPT-5.5 for deep product/interaction logic | Small styling/copy/Tailwind tweaks |
| Reviewer | GPT-5.5 for final/deep review; GPT-5.4 for normal review | GPT-5.5 | Typos/formatting/surface checks only |

## General Rules

- Use GPT-5.5 when the task requires judgment.
- Use GPT-5.4 when the task requires solid execution.
- Use GPT-5.4 Mini when the task requires speed and the instructions are precise.
- Start with the cheapest capable model, then escalate immediately if the work becomes vague, risky, cross-file, architecture-heavy, debugging-heavy, or regression-sensitive.

## Default Setup

- Architect: `oauth-router/gpt-5.5` for serious planning, `oauth-router/gpt-5.4` for normal planning.
- Coder: `oauth-router/gpt-5.4` by default, `oauth-router/gpt-5.5` for complex work, `oauth-router/gpt-5.4-mini` for simple explicit tasks.
- Designer: `oauth-router/gpt-5.4` by default, `oauth-router/gpt-5.4-mini` for small styling tasks.
- Reviewer: `oauth-router/gpt-5.5` for final/deep review, `oauth-router/gpt-5.4` for normal review.

Treat GPT-5.4 Mini like a fast junior implementer: excellent when the task is specific, dangerous when the task is vague.
