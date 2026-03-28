# T18 Builder Prompt Enforcement Update

**Mode:** `vibe-architect`  
**Workflow:** `/vibe-design`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-design`.
- Run `/vibe-primeAgent`.
- Load `takomi`.
- Do not use `context7`.

## Objective

Update the builder prompt so later build agents must treat the design-system and mockups as the authoritative UI source.

## Scope

Included: builder prompt alignment, mockup enforcement language, priority ordering.  
Excluded: build-task implementation.

## Context

Without this, later build sessions may drift away from the approved visual direction.

## Definition of Done

- Builder prompt references the new mockups explicitly.
- The mockup-driven rule is unambiguous.

## Expected Artifacts

- Updated `docs/Builder_Prompt.md`

## Constraints

- Keep the prompt practical and not overly verbose.

## Verification

- Confirm the prompt requires checking mockups before UI implementation.

