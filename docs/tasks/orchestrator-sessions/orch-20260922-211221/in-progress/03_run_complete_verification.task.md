# Task 03: Run complete verification

## Agent setup
### Workflow to follow
Takomi Build verification pass.
### Prime agent context
Read `AGENTS.md`, Convex guidelines, `package.json`, all workspace scripts, the master plan, and Task 02 findings.
### Optional skill and context overlays
Use `code-intelligence`, `convex`, `security-audit`, and `unslop`.
## Objective
Run every repository-defined automated test and relevant static or production build check against the exact PR head.
## Scope
Install locked dependencies if required. Run root and package tests, lint, typechecks, builds, Playwright suites, code generation validation, toast and theme audits, and non-mutating security checks.
## Context
Record exact commands, exit codes, durations, and failures. Classify branch, baseline, tooling, environment, and external-service failures.
## Definition of done
- Every declared test script is accounted for.
- Root lint, typecheck, test, build, and E2E scripts have outcomes.
- Failures are reproducible.
- No test is weakened.
## Expected artifacts
- Verification matrix
- Failure extracts
- Reproduction commands
## Constraints
Do not deploy, mutate data, send email, create payments, or change Tailscale.
## Dependencies
Task 02.
## Verification
Re-run environment failures where possible and confirm commit stability.
