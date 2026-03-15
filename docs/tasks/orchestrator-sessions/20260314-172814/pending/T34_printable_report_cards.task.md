# T34 Printable Report Cards

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `pdf`.
- Do not use `context7`.

## Objective

Implement branded report-card rendering for screen and print, including teacher comments, head-teacher comments, and school identity.

## Scope

Included: report-card data shaping, print-friendly layouts, export-oriented views.  
Excluded: notification delivery when reports are published.

## Context

This task fulfills `FR-008` and consumes published academic data.

## Definition of Done

- Report cards render with branding and comment sections.
- Layout is readable on-screen and printable.
- Shared data contracts are stable for portal reuse.

## Expected Artifacts

- report-card UI and print views
- report-card data types

## Constraints

- Keep print styles deliberate, not browser-default.
- Preserve school-specific branding hooks.

## Verification

- Print preview and portal display both render the same core report data correctly.

