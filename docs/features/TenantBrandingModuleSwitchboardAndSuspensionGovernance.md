# Specification: Tenant Branding, Platform Module Switchboard Governance, and Workspace Suspension

## Problem Statement

Educational institutions running on the multi-tenant school management platform need autonomous control over their school branding (logos, brand color palettes, mottos, and contact information), while platform super administrators require granular governance over which modular capabilities (billing, curriculum studios, AI assistants, and admissions) are enabled per school. 

Prior to this specification:
1. School branding was fragmented: logo uploads were hidden deep inside report card extra settings, brand color palettes were not dynamically propagated to print letterheads and invoices, and school administrative contact info was not accessible during tenant disruptions.
2. Platform module access was all-or-nothing: disabling a feature removed the navigation link but left underlying routes accessible, lacking transparent workspace-level audience indicators (`Admin`, `Teacher`, `Portal`, `Public`).
3. Tenant suspension lacked graceful error containment: suspending a school caused backend authorization errors to cascade into uncaught Next.js client exceptions and crash overlays across admin, teacher, and student portal layouts.
4. Platform management dashboards suffered from cramped table layouts on widescreen monitors, text squishing, and abrupt filter transitions.

## Solution

A unified tenant branding, modular switchboard, and layout-level governance architecture:
1. **Dedicated School Admin Settings (`/admin/settings`):** School administrators can manage their institutional profile, logo, tagline/motto, primary and accent brand palettes, and official contact channels. These branding tokens automatically flow into report cards, transcripts, receipts, and portal themes.
2. **Programmatic Platform Module Switchboard:** Super administrators can toggle modular capabilities per tenant with real-time workspace blast radius transparency (`[ADMIN]`, `[TEACHER]`, `[PORTAL]`, `[PUBLIC]`), ensuring complete route shielding when a feature is turned off.
3. **Global Layout-Level Suspension & Error Containment:** A fail-safe layout guard across all eight workspace layouts prevents child queries from firing when a school is suspended, presenting a clean lock screen with configurable platform support and school administrative contact modals.
4. **Fluid High-Density Platform Console:** A 100% fluid full-width dashboard with zero-config FLIP animations (`useAutoAnimate`), proportional data tables, and an executive mobile card configuration.

---

## User Stories

### School Administration & Branding
1. As a School Administrator, I want a dedicated Settings page (`/admin/settings`), so that I can manage my institution's identity without navigating deep into academic submenus.
2. As a School Administrator, I want to update our school name, official tagline/motto, and contact information (phone, email, physical address), so that our official records accurately reflect our school.
3. As a School Administrator, I want to upload our school crest/logo and select primary and accent brand colors, so that our generated documents and portal headers match our visual identity.
4. As a School Administrator, I want our chosen primary and accent colors to automatically style printable report cards and transcripts, so that printed student documents look distinguished and authentic.
5. As a School Administrator, I want our school logo, motto, and contact details printed on official billing invoices and payment receipts, so that parents receive standardized financial statements.
6. As a School Administrator, I want protected system fields (such as our unique tenant slug and platform subscription status) to remain read-only in my dashboard, so that critical multi-tenant identifiers cannot be accidentally mutated.

### Platform Super Administration & Governance
7. As a Platform Super Administrator, I want a centralized School Management dashboard (`/schools`), so that I can oversee all registered, active, pending, and suspended school tenants.
8. As a Platform Super Administrator, I want to toggle modular features (Billing, Curriculum Studio, AI Knowledge Library, Online Admissions) per tenant, so that schools only access the tier they subscribed to.
9. As a Platform Super Administrator, I want to see clear workspace badges (`[ADMIN]`, `[TEACHER]`, `[PORTAL]`, `[PUBLIC]`) next to controlled routes in the module switchboard, so that I understand exactly which user roles and URLs are affected when toggling a module.
10. As a Platform Super Administrator, I want disabled module routes to be immediately shielded from sidebars and direct URL access, so that tenants cannot access deactivated features.
11. As a Platform Super Administrator, I want to suspend and reactivate school tenants with a single click and confirmation modal, so that platform policy or subscription enforcements take immediate effect.
12. As a Platform Super Administrator, I want to reset any school admin's password with temporary credential provisioning, so that locked-out administrators can regain access safely.
13. As a Platform Super Administrator, I want to assign administrators to newly provisioned schools awaiting setup, so that onboarding flows without manual database edits.

### Teachers, Parents, and Students
14. As a Teacher, I want my dashboard to load only the modules enabled for my school (e.g. Lesson Studio, Question Assistants), so that my workspace remains uncluttered.
15. As a Parent or Student, I want to view my school's branding, motto, and support contacts in the portal, so that I know I am in the official school environment.
16. As a Teacher or Parent of a suspended school, I want to see a clear, branded suspension lock screen with official contact options instead of a technical error crash, so that I understand the disruption and know whom to contact.

### Usability & Experience
17. As a Platform Super Administrator on a widescreen monitor, I want the dashboard to utilize my full screen width, so that dense school data and action buttons do not feel squished or require unnecessary horizontal scrolling.
18. As a Platform Super Administrator on mobile, I want school tenants displayed as clean, executive cards with proper margins and action grids, so that I can manage schools on the go.
19. As a Platform Super Administrator, I want filter and search changes to animate smoothly with FLIP transitions, so that rows and cards do not abruptly flash or snap.

---

## Implementation Decisions

### 1. Data Model & Branding Schema
- **Tenant Branding Schema (`packages/convex/schema.ts`):**
  - `logoUrl`: Optional string storage ID / URL.
  - `tagline`: Institutional motto / slogan.
  - `primaryColor`: Hex color string (defaulting to institutional navy/indigo `#1e3a8a`).
  - `accentColor`: Hex color string (defaulting to emerald/amber `#059669`).
  - `contactEmail`, `contactPhone`, `address`: Official administrative contact info.
  - `status`: Tenant lifecycle state (`"active" | "pending" | "suspended"`).
  - `features`: Modular boolean flags (`billing`, `curriculum`, `knowledgeLibrary`, `admissions`).

### 2. Programmatic Module Registry (`PLATFORM_MODULE_DEFINITIONS`)
- Stored as a single source of truth in `@school/shared/workspace-navigation.ts`.
- Encodes module keys, display names, badges, descriptions, and explicit `controlledRoutes` arrays tagged with targeted workspaces (`Admin`, `Teacher`, `Portal`, `Public`).
- Consumed dynamically by platform switchboard modals, route middleware, and navigation menu builders.

### 3. Layout-Level Suspension Guard Pattern
- Evaluated in workspace client layouts (`apps/admin`, `apps/teacher`, `apps/portal`) before mounting `{children}`:
  1. If `schoolBranding === undefined`: Render `<MeloLoader />` (blocks child queries from firing prematurely).
  2. If `schoolBranding?.status === "suspended"`: Render `<SchoolSuspendedLockScreen />` (stops child queries, rendering a dedicated lock screen with school contact and platform support trigger).
  3. If active: Mount `{children}` normally.
- Backend authorization helper `getAuthenticatedSchoolMembership` supports an `allowSuspended: true` option so the branding query can fetch school metadata without throwing uncaught server errors.

### 4. Zero-Config FLIP Animations (`useAutoAnimate`)
- Packaged into `@school/shared` using `@formkit/auto-animate`.
- Attached directly to table `<tbody>` and card list parent containers to handle list re-ordering, insertions, and deletions smoothly across search and filter updates.

### 5. Fluid Responsive Layout
- Main layout containers in the platform console use `w-full px-4 sm:px-8 lg:px-12` for edge-to-edge widescreen density.
- Tables utilize proportional minimum widths on columns to prevent single-word vertical wrapping.
- Mobile viewports switch to an executive card layout with initials avatar badge, metadata strip, and a balanced 3-button action grid.

---

## Testing Decisions

### What Makes a Good Test
- Tests must verify external behavioral contracts: correct propagation of branding tokens, strict shielding of deactivated routes, and proper status transitions without leaking backend runtime errors.

### Module Test Scope
1. **Branding Mutation & Query Contract:** Verify that updating primary/accent colors and mottos via `updateSchoolBranding` persists and returns updated metadata in `getCurrentSchoolBranding`.
2. **Suspension Authorization Contract:** Verify that a suspended school returns suspended branding metadata with `allowSuspended: true`, while write mutations throw clear tenant suspended errors.
3. **Module Feature Gating Contract:** Verify that toggling off a feature flag updates the tenant feature set and removes controlled routes from navigation selectors.
4. **TypeScript & Interface Safety:** Verify all workspace packages (`convex`, `shared`, `platform`, `admin`, `teacher`, `portal`) compile with `tsc --noEmit` with zero errors.

---

## Out of Scope
- Dynamic custom CSS stylesheet generation for arbitrary custom fonts.
- Direct credit card billing integration for platform-level SaaS subscription billing (handled via existing billing service agreements).
- Self-serve deletion of school tenants (schools can only be archived or suspended to prevent accidental data loss).

---

## Further Notes
- Demo school **Meridian Crest Academy** (`slug: meridian-crest`, Head Admin: `admin@meridiancrest.org`) is provisioned as the canonical test fixture for visual branding, module toggles, and report card print verification.
