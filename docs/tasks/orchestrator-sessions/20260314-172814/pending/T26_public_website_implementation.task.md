# T26 Public Website Implementation

**Mode:** `vibe-code`  
**Workflow:** `/vibe-build`

## Agent Setup (DO THIS FIRST)

- Read `/vibe-build`.
- Run `/vibe-primeAgent`.
- Load `frontend-design` and `nextjs-standards`.
- Do not use `context7`.

## Objective

Implement the tenant-themed public website in `apps/www` using the approved design system, sitemap, and copy deck.

## Scope

Included: route structure, responsive pages, reusable content sections, branding hooks.  
Excluded: SEO metadata wiring and authenticated app features.

## Context

This task fulfills the public-facing school site portion of `FR-011`.

## Definition of Done

- Core public pages are built in Next.js.
- School branding can be injected without rewriting components.
- Pages align with the approved mockups.

## Expected Artifacts

- `apps/www` routes and components
- shared UI or feature modules as needed

## Constraints

- Build mobile-first.
- Preserve the ability to map schools by slug and later by domain.

## Verification

- Public routes render and match the mockups at core breakpoints.

