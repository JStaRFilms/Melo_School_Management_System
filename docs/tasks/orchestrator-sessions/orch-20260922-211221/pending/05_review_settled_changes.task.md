# Task 05: Review settled changes

## Agent setup
### Workflow to follow
Takomi review and finalize.
### Prime agent context
Read `AGENTS.md`, Convex guidelines, master plan, findings, verification, and exact correction diff.
### Optional skill and context overlays
Use `code-review`, Convex security, `security-audit`, scope control, and `unslop`.
## Objective
Verify corrections solve confirmed defects without regressions or excess scope.
## Scope
Review standards and specification axes separately. Recheck auth, tenant boundaries, payments, identity, migrations, callers, and test adequacy.
## Context
One independent review. Return required corrections to the original implementer. Do not recurse indefinitely.
## Definition of done
- Each blocker has a disposition.
- No release blocker remains.
- Optional suggestions are deferred.
- Verification is checked.
## Expected artifacts
- Review report
- Correction requests
- Acceptance disposition
## Constraints
Read-only. Do not edit, push, resolve threads, or broaden scope.
## Dependencies
Task 04, skipped if no code changed.
## Verification
Review the exact settled diff.
