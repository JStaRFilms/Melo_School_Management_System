# Design Phase Prompt for Personal Agent

**Session:** orch-20260314-172814  
**Phase:** Design (T11-T18)  
**Status:** Ready for delegation

---

## Project Context

**Project:** School Management System - A mobile-first, white-label school operating system  
**Tech Stack:** Next.js App Router, TypeScript, pnpm workspaces, Turborepo, Convex, Better Auth  
**Current State:** PRD and Functional Requirements are complete (see `docs/Project_Requirements.md` and `docs/issues/FR-XXX.md`)

---

## Prompt to Give Your Personal Agent

```
You are working on the DESIGN PHASE for a School Management System project.

## Project Context

**Project:** School Management System - A mobile-first, white-label school operating system
**Tech Stack:** Next.js App Router, TypeScript, pnpm workspaces, Turborepo, Convex, Better Auth
**Current State:** PRD and Functional Requirements are complete (see docs/Project_Requirements.md and docs/issues/FR-XXX.md)

## Your Mission

Execute the following 8 design tasks (T11-T18), creating artifacts in the docs/design/ and docs/mockups/ directories:

### Task T11: Brand and White-Label Design Brief
Create `docs/design/brand-brief.md` defining:
- Design principles and mood (trustworthy, modern, education-focused)
- Color system with primary, secondary, accent, and semantic colors
- School-brand override rules (what changes per school vs. platform consistency)
- Typography direction
- Mobile-first approach for school community

### Task T12: Global Sitemap
Create `docs/design/sitemap.md` covering all FOUR apps:
- **Public Website (www):** Home, About, Academics, Contact, Admissions CTA
- **Admin App:** Onboarding, School Config, Academics Setup, Results, Support, Billing
- **Teacher Workspace:** Dashboard, Lesson Planning, Class/Subject Access, Results Entry, Quiz/CBT
- **Parent/Student Portal:** Dashboard, Report Cards, Payments, Notifications, Linked Student Switching

Include page purposes, route groupings, and key components for each.

### Task T13: Shared Design System Foundation
Create `docs/design/design-system.html` (or .md) with:
- Design tokens (colors, spacing, typography, shadows)
- Core components: buttons, inputs, cards, tables, navigation, modals, badges
- Form patterns with validation states
- Responsive/mobile-first rules
- Print-friendly styles for report cards
- Accessibility considerations

### Task T14: Public Website Mockups
Create HTML mockups in `docs/mockups/www/` for:
- Home page with hero, features, testimonials, CTA
- About page
- Academics page
- Contact page
- Admissions CTA flows

Reflect the brand brief and support white-label theming.

### Task T15: Admin App Mockups
Create HTML mockups in `docs/mockups/admin/` for:
- Dashboard with key metrics
- Onboarding flows (school setup, user import)
- Academics management (sessions, terms, classes, subjects, teacher assignments)
- Results oversight and moderation
- Support panel (read-only)
- Billing operations and collections

### Task T16: Teacher Workspace Mockups
Create HTML mockups in `docs/mockups/teacher/` for:
- Teacher dashboard
- Lesson note planning with OCR entry point
- Class and subject access views
- Results entry interface
- Quiz/CBT generation (AI integration point)
- Class student list

### Task T17: Parent/Student Portal Mockups
Create HTML mockups in `docs/mockups/portal/` for:
- Parent dashboard
- Student dashboard (simplified)
- Report card viewer (print-ready)
- Invoice and payment history
- Notification center
- Linked student switching for parents

### Task T18: Builder Prompt Enforcement
Update `docs/Builder_Prompt.md` to add:
- Explicit requirement that /docs/mockups/* are the source of truth for UI
- Rule that all implementation must reference mockups before coding
- Enforcement language to prevent drift from approved designs

## Key Constraints

1. **Mobile-first:** All designs must work excellently on mobile
2. **White-label ready:** Design system must support per-school branding overrides
3. **Avoid generic SaaS:** Make it feel premium and education-specific
4. **Production quality:** These mockups will drive actual implementation

## Skills to Use

- frontend-design
- ui-ux-pro-max
- copywriting (for public site)
- seo-ready (for public site considerations)

## Deliverables Summary

| Task | Deliverable |
|------|-------------|
| T11 | docs/design/brand-brief.md |
| T12 | docs/design/sitemap.md |
| T13 | docs/design/design-system.html |
| T14 | docs/mockups/www/*.html |
| T15 | docs/mockups/admin/*.html |
| T16 | docs/mockups/teacher/*.html |
| T17 | docs/mockups/portal/*.html |
| T18 | Updated docs/Builder_Prompt.md |

Start with T11 and work sequentially through T18. Each task's output informs the next.
```

---

## Design Tasks Status

| Task | Name | Deliverable | Status |
|------|------|-------------|--------|
| T11 | Brand and White-Label Design Brief | `docs/design/brand-brief.md` | Pending |
| T12 | Global Sitemap | `docs/design/sitemap.md` | Pending |
| T13 | Shared Design System Foundation | `docs/design/design-system.html` | Pending |
| T14 | Public Website Mockups | `docs/mockups/www/*.html` | Pending |
| T15 | Admin App Mockups | `docs/mockups/admin/*.html` | Pending |
| T16 | Teacher Workspace Mockups | `docs/mockups/teacher/*.html` | Pending |
| T17 | Parent/Student Portal Mockups | `docs/mockups/portal/*.html` | Pending |
| T18 | Builder Prompt Enforcement Update | Updated `docs/Builder_Prompt.md` | Pending |

---

## Next Step

After your personal agent completes T11-T18, return here and tell me "Design phase complete" so I can continue with Foundation tasks (T19-T24).
