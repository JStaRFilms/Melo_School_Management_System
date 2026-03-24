# T06 FR Catalog and MUS/Future Split

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-genesis`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-genesis`.
- Run `/vibe-primeAgent`.
- Load `takomi` and `avoid-feature-creep`.
- Do not use `context7`.

## Objective

Review the FR list and confirm the MUS versus Future split is realistic, disciplined, and aligned with the first production release.

## Scope

Included: FR ordering, priority review, MUS/Future validation.  
Excluded: issue-file writing beyond necessary updates.

## Context

The current FR set includes public website, academics, billing, AI tools, and future mobile and analytics expansion.

## Definition of Done

- MUS features are consistent with the first release target.
- Future features remain documented without bleeding into the current build.
- FR ordering supports implementation sequencing.

## Expected Artifacts

- Updated `docs/Project_Requirements.md`

## Constraints

- Do not demote core billing, security, or portal requirements.
- Keep future scope explicit instead of implied.

## Verification

- Confirm `FR-019` through `FR-021` remain Future.
- Confirm core release-critical work stays MUS.

