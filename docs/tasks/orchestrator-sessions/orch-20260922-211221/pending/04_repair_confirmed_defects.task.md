# Task 04: Repair confirmed defects

## Agent setup
### Workflow to follow
Takomi Build implementation pass.
### Prime agent context
Read `AGENTS.md`, Convex guidelines, the master plan, review ledger, and verification matrix.
### Optional skill and context overlays
Use Convex skills, bug diagnosis, blast radius, root-cause repair, scope control, and `unslop`.
## Objective
Fix only reproduced regressions and blocking correctness, security, data-loss, tenant-isolation, or requirement defects.
## Scope
Implement the smallest root-cause correction. Add focused tests only where existing coverage cannot protect corrected behavior. Update docs only when contracts change.
## Context
One bounded implementation pass. Optional suggestions and unrelated cleanup remain out of scope.
## Definition of done
- Every edit maps to a finding.
- Focused and affected checks pass.
- Theme audit runs for touched school-facing files.
- No unrelated artifacts enter the diff.
## Expected artifacts
- Product fixes
- Justified regression tests
- Fix mapping
## Constraints
Do not rebase, amend, deploy, merge, or decide unresolved product questions.
## Dependencies
Tasks 02 and 03.
## Verification
Inspect the diff, rerun checks, and simplify.
