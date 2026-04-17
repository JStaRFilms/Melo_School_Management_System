# Tenant School Public-Site Engine and Template System

## Goal

Provide a dedicated tenant school public-site app in `apps/sites` that resolves school context at request time, loads school branding and content at runtime, and renders a structured template/composition system without repurposing the SchoolOS marketing site.

## Scope Boundary

This feature covers the school-facing public website surface only:

- request-time hostname resolution
- runtime school branding and content loading
- template family selection via `templateKey`
- page visibility and section ordering/composition
- the core public pages:
  - home
  - about
  - academics
  - admissions
  - fees
  - visit
  - contact
- safe unknown/inactive host handling

It does **not** include:

- the SchoolOS marketing site in `apps/www`
- platform admin or internal workspace surfaces in `apps/platform`
- authenticated role/workspace handoff UX
- domain verification onboarding UX
- Convex schema expansion beyond what this foundation needs

## Components

### Runtime Resolution
- `apps/sites/lib/site.ts`
- hostname normalization and request host parsing
- school resolution from platform-managed subdomains and custom domains
- active/inactive/unknown host handling

### Template Contract
- `apps/sites/lib/site.ts`
- 5 template families defined in code:
  - modern campus
  - classic institutional
  - primary garden
  - secondary studio
  - faith tradition
- page layouts with visibility and ordered section slots
- room for future pages through template-level supported page listings

### Rendering
- `apps/sites/lib/site-ui.tsx`
- public shell, header, footer, CTA bands, and page sections
- page composition driven by the active school template

### Routes
- `apps/sites/app/[[...slug]]/page.tsx`
- `apps/sites/app/not-found.tsx`
- `apps/sites/app/layout.tsx`

## Data Flow

1. A request arrives with a hostname.
2. The site resolves the hostname to a school and template.
3. The route resolves the requested page slug.
4. The school's theme, branding, contact details, and page content load from the in-app registry.
5. The page renders using the template's ordered section slots.
6. Unknown or inactive hosts fall back to a safe not-found state.

## Design Contract

### Template Families
The app now defines five school-site template families in code so the design system can expand without rewriting the public-site engine.

### Section Composition
Each page can choose its own ordered slots, such as:

- hero
- points
- cards
- timeline
- steps
- fees
- faq
- contacts
- note
- cta

### Page Visibility
Page layouts can be marked visible or hidden, which leaves room for future school-specific pages without turning the app into one-off routes.

### Future Pages
The contract explicitly leaves room for future pages such as gallery, boarding, programme pages, and other school-specific expansions.

## Implemented Outcome

- `apps/sites` is now a real dedicated tenant school public-site app.
- School context resolves from hostname at request time.
- Branding, contact details, and page content are loaded per school.
- The homepage and core support pages are rendered from runtime school data.
- Unknown/inactive hosts fail safely.
- The app is visually and conceptually separate from the SchoolOS product marketing site.

## Regression Checks

- The public-site app must not advertise the SchoolOS product.
- No internal `/schools` CTAs should leak into the school website surface.
- The school site must stay independent from `apps/www`.
- Future public-domain onboarding and canonical routing stay for later tasks.
