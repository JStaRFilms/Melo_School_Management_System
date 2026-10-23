# Independently review the committed optimization branch

## Objective
Apply the branch-review skill to the complete local optimization branch and identify actionable defects introduced by it. The owner requested a local babysit-pr review loop, not hosted PR operations.

## Prime context
Read C:/Users/johno/.agents/skills/branch-review/SKILL.md, repository AGENTS.md, and packages/convex/_generated/ai/guidelines.md. Review docs/tasks/ConvexOptimizationEvidence-20261023.md as evidence to verify, not as a substitute for source inspection.

## Scope
Compare perf/convex-egress-evidence against explicit local base 94ef195, including committed, staged, unstaged and relevant untracked changes. Inspect every changed implementation, consumer, test and document. Focus on complete results, tenant/admin authorization, optional archive flags, scoring-lock redaction, class selector compatibility, Sites asset rights/consent/kind/checksum/freshness, and validity of claimed performance measurements.

## Constraints
Read-only. Do not edit, stage, commit, fetch, push, create a PR/issue, deploy, merge, rebase, seed/reset, run migrations, disable jobs or access credentials/private school records. Inspect scripts before any tests; no integration/E2E setup, cloud commands or network activity. Safe in-process tests are allowed. No style nits, speculative improvements or unrelated cleanup.

## Definition of done
Establish base/head/status and read the entire review scope. Return REVIEW CLEAR, NEEDS CHANGES or INCOMPLETE with stable BR IDs, exact file/line, severity/confidence, triggering condition, consequence and concise fix direction. Disclose uninspected files/checks. Zero findings is valid.

## Expected artifacts
A concise reviewer finding ledger and checks/coverage limitations. Parent records it locally and triages before changes. If corrections are necessary, the final T3 review is a new delegate_task carrying the original brief and complete finding/disposition ledger, not a message to the backing child thread.
