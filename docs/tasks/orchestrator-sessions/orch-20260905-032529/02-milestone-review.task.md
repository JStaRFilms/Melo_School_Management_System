# R1 — Productization integration milestone review

## Agent setup
Independent reviewer, Sol high, read-only. Read AGENTS, Convex generated guidelines, parent product decisions, current session implementation-plan, coverage matrix and results. Review only changes since f6fc7c4817eb287daeebf78a4d143ef1a988844f, not prior full audit.

## Objective/scope
Review new U1–U6 integration code for concrete security, tenant, financial/history, draft, provider-gate, accessibility and build defects. Identify user-requested safe in-repository scope that implementers left partial, separating it from genuine external gates. Focus review on material correctness, not cosmetic nits.

## Definition of done
Write review-findings.md with prioritized actionable file/line findings, exact fixes/acceptance checks and a finite remediation list. Inventory omissions are not implicitly accepted. Run narrow non-live tests if useful, never seed or connect backend. Report actual checks only.

## Artifacts
review-findings.md, including milestone recommendation and required regressions.

## Constraints
No code writes or commits; review documentation permitted. No credentials, env values, live Convex, deployment, migrations, providers or production. Other agents may perform development-target/evidence preflight but no implementation writes during review. User wants autonomous continuation after review.
