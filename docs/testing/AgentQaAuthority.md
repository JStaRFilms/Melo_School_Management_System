# QA authority

The owner granted standing approval on 2026-09-30 for work in the QA branch and the isolated test backend. Use this scope to complete testing without asking for routine isolated-development steps.

## Allowed scope

- Local worktree code, tests, documentation, and a project-local verification skill.
- Inspect and exercise `dev:content-poodle-172` with synthetic accounts and data.
- Deploy code/schema and configure test-only origins on that isolated deployment when needed for verification. Use a short-lived deployment-specific credential, prove isolated access and normal-dev denial, preserve cohort data, and revoke the credential after maintenance.
- Retain traces/videos privately and publish reviewed, sanitized evidence to the private Tailnet share.

## Protected scope

Production and normal development `dev:scrupulous-chinchilla-25` are outside the write scope. Keep their code, schema, data, environment, credentials, and services unchanged. Read-only metadata comparison and authentication-denial checks may establish isolation; they are not authorization for a corrective write or rollback.

Use the exact-target maintenance procedure in [AgentQa.md](AgentQa.md). Standing approval changes who needs to ask, not the target or credential checks. A broad login token, a project selector, or an env filename alone is insufficient proof.

Retain synthetic data rather than treating this approval as a reason to reset it. If an operation would require a production or normal-dev change, record a blocker and ask the owner instead of switching targets. Staged indexes remain staged until a separately reviewed rollout establishes readiness and activation order.

Provider credentials alone do not establish payment test mode, safe email recipients, or an AI spending boundary. Establish those test-only conditions before provider journeys; use a blocker when they are missing.
