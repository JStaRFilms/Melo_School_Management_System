# T02 Skills and Workflows Registry

**Mode:** `mode-orchestrator`  
**Workflow:** `/mode-orchestrator`

## Agent Setup (DO THIS FIRST)

- Read `/mode-orchestrator`.
- Run `/vibe-primeAgent`.
- Load `takomi`.
- Do not use `context7`.

## Objective

Audit the available skills and workflows used by this project and verify the registry in the session master plan is accurate and minimal.

## Scope

Included: registry audit, skill-purpose mapping, workflow-phase mapping.  
Excluded: introducing new skills not justified by current scope.

## Context

The current registry lives in `master_plan.md` and must remain aligned with the project’s available local skills.

## Definition of Done

- Every referenced skill has a clear task purpose.
- Every referenced workflow maps to at least one task.
- `context7` is explicitly excluded.

## Expected Artifacts

- Updated skills/workflows registry in `master_plan.md`

## Constraints

- Prefer the minimal skill set that covers the work.
- Remove redundant skills instead of inflating the stack.

## Verification

- Cross-check each task against the registry.
- Confirm no task references `context7`.

