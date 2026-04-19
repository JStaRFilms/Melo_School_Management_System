# Public Web Operating Modes And Onboarding Policy

## Goal

Define the supported public-web operating modes so school onboarding is not blocked by a single website assumption and the platform keeps its marketing site separate from tenant school websites.

## Scope Boundary

This policy covers operating-mode decisions, onboarding recommendations, minimum branded entry points, and ownership boundaries.

It does **not** cover:

- the runtime multi-tenant public-site engine
- template composition
- public-domain verification and canonical routing
- authenticated workspace auth handoff details
- platform SaaS billing

## Operating Modes

### Mode A - SchoolOS Marketing Website

The platform has its own marketing site for SchoolOS.

- audience: school owners, administrators, and operators
- purpose: sell and explain the product
- separation rule: this site is never treated as a tenant school public website

Repository implementation note:

- In this codebase, the Mode A surface lives in `apps/www` at `/`.
- The platform workspace remains separate under `/schools`, `/sign-in`, and `/bootstrap/platform-admin`.

### Mode B - School Keeps Existing Website

The school keeps its current external website and uses it as the primary public-facing presence.

The platform provides only the minimum branded handoff needed to support adoption:

- school-branded login entry points
- portal entry points
- staff/admin entry points
- teacher entry points
- fee-payment or contact handoff links when those surfaces exist

The school continues to own and update its own marketing content.

### Mode C - Platform-Built School Website

The platform builds and hosts the school's public website as part of onboarding or a managed service path.

- the school can use a shared template with branding and content customization
- the site may start on a platform-managed school hostname
- the school may later attach a custom public domain

## Onboarding Policy

### Default Recommendation For New Schools

Start new schools in **Mode B** unless the school explicitly wants a managed website rollout.

Why:

- it removes friction from onboarding
- it lets admin, teacher, and portal workflows go live without waiting on full website production
- it avoids forcing every school into a website migration on day one

### Can A School Start In Mode B And Later Move To Mode C?

Yes.

The school should be able to begin with its existing site, then later adopt a platform-built website without changing its core school record or losing operational continuity.

The migration is a public-web cutover, not a re-onboarding event.

## Minimum Branded Entry Points

Every school should have a minimal branded presence even if it keeps its existing website.

At minimum, the platform should provide:

- the school name, logo, and brand colors
- portal sign-in entry
- staff/admin sign-in entry
- teacher sign-in entry when needed
- a clear contact or payment handoff path when those workflows exist

These entry points should be lightweight and purpose-built, not a full replacement for the school's own website unless the school chooses Mode C.

## Ownership Boundaries

### Platform-Team Managed

The platform team owns:

- the operating-mode policy
- canonical workspace link structure
- product marketing content for Mode A
- the initial managed-site template and starter content for Mode C
- the transition rules between modes

### School-Managed

The school owns:

- its existing website content in Mode B
- factual school information such as address, contact details, policies, and admissions copy
- final approval of school branding and public-facing wording
- any later custom content updates if the school takes control of its managed site

## Migration Path From Mode B To Mode C

A school that begins with its own website should be able to move to a platform-built site later using a simple path:

1. Keep the external site live while the school is onboarded operationally.
2. Add the minimum branded entry points for portal, staff, and teacher access.
3. Prepare the managed school site using the shared template and approved branding.
4. Publish the managed site on a platform-controlled hostname or staging domain.
5. Attach the custom public domain when DNS and verification are ready.
6. Redirect or retire the old public website only after the new site is stable.

This keeps admissions and search visibility from being disrupted unnecessarily.

## Alignment Notes

This policy matches the topology direction in `docs/features/MultiTenantDomainAndAuthTopology_2026-04-12.md`:

- Mode A is the platform-owned marketing surface.
- Mode B keeps authenticated workspaces simple while allowing the school to retain its own public presence.
- Mode C is the managed public-site path that can later attach custom domains.
- Advanced school-owned role subdomains remain a later topology option and are not required for this onboarding policy.

This policy also sets the boundary for the follow-on public-web sequence in `T20-T23`.

## Definition Of Done

- The three operating modes are named and differentiated clearly.
- The default onboarding recommendation is explicit.
- The B-to-C migration path is documented.
- Minimum branded entry points are defined for schools that keep their own sites.
- Platform-managed and school-managed responsibilities are separated cleanly.
- The policy stays aligned with the multi-tenant topology note and the public-web backlog.