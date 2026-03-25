# Builder Prompt

## Stack-Specific Instructions

- This is a `pnpm` + `Turborepo` monorepo with four Next.js apps and one shared Convex backend.
- Treat `docs/Project_Requirements.md` and `docs/issues/FR-XXX.md` as the product source of truth.
- Respect tenant boundaries, role routing, and mobile-first layouts.
- Exclude `context7` from any spawned task unless the user explicitly overrides that rule later.

## Mandatory Mockup-Driven Implementation

The `/docs/mockups/admin` folder is the source of truth for all front-end UI and UX.
Before implementing any page, open the corresponding mockup and replicate its structure, states, typography, and responsive behavior.
Key Mockups for Academic Setup:
- `admin-academic-config.html` (Sessions, Terms, Subjects)
- `admin-teacher-management.html` (Staff listing/creation)
- `admin-class-management.html` (Classes and offerings)
- `admin-student-enrollment.html` (Student roster & subject matrix)
- `teacher-academic-enrollment.html` (Teacher-level enrollment view)

## MUS Priority Order

1. Monorepo and backend foundation
2. Auth, permissions, and tenant model
3. School setup and academic structure
4. Results, report cards, and portal
5. Billing and payments
6. Public website, copy, SEO, and notifications
7. AI teacher tools
8. Security, testing, and handoff

## Special Considerations

- Support both primary and secondary teaching assignments in one domain model.
- Keep payment integrations provider-agnostic in structure but optimized for Paystack first.
- Admin support surfaces are read-only.
- Delivery is for one school first, but the codebase must remain reusable for additional schools without a rewrite.
