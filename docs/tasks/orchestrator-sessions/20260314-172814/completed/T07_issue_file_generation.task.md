# T07 Issue File Generation

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-genesis`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-genesis`.
- Run `/vibe-primeAgent`.
- Load `takomi` and `spawn-task`.
- Do not use `context7`.

## Objective

Create or refine one issue file per FR so each requirement has its own execution context, acceptance criteria, and architectural guidance.

## Scope

Included: issue files for all current FRs, acceptance criteria, labels, solution outline.  
Excluded: execution task files.

## Context

Issue files live under `docs/issues/` and bridge product requirements to build tasks.

## Definition of Done

- Every FR has an issue file.
- Acceptance criteria are testable and aligned with the PRD.
- Future issues are documented without over-specifying implementation.

## Expected Artifacts

- `docs/issues/FR-001.md` through `docs/issues/FR-021.md`

## Constraints

- Keep issues high signal; do not turn them into full implementation changelogs.
- Preserve stable FR ids.

## Verification

- Confirm file coverage for every FR in the PRD.
- Confirm acceptance criteria are present in each issue.

