# Managed School-Site Delivery And Editing Boundaries

## Goal

Define how the platform delivers a school public website during onboarding, how editing responsibility is split between the platform team and school admins, and how a school can start on an external website and later move to a platform-built managed site without turning the product into a full no-code builder.

This feature sits on top of the T20-T22 public-site foundation already present in `apps/sites`.

---

## Scope Boundary

This feature covers the delivery and operating policy for managed school sites:

- onboarding workflow for a new school public site
- template selection ownership
- initial content collection and approval flow
- platform-team-managed vs school-admin-editable boundaries
- change request and page expansion model
- external-site integration for schools that keep their own website
- migration path from external site to managed site
- standard vs premium/custom website service lanes

It does **not** include:

- a full visual page builder
- freeform self-serve CMS editing
- new Convex schema for editable site content
- marketing-site changes in `apps/www`
- authenticated workspace UX or auth handoff details
- a one-off bespoke codebase per school

---

## Operating Model

The operating model is a managed service, not a self-serve website builder.

That means:

- the platform team owns the public-site structure and launch process
- the school owns factual content and approval of its public wording
- template choice is curated from the shared template library
- new pages are added through controlled requests, not ad hoc route creation
- all managed sites stay inside the shared `apps/sites` engine

The current runtime already knows how to resolve schools, load templates, render page slots, and choose canonical domains. T23 defines how we deliver and evolve those sites in real onboarding work.

---

## Onboarding Workflow For A New School Public Site

### 1. Classify The Operating Mode

At intake, the school is placed into one of two public-web paths:

- **Mode B** - the school keeps its external website and uses the platform for minimum branded handoff links
- **Mode C** - the platform builds and hosts the school's managed public site

The default recommendation remains Mode B unless the school explicitly wants a managed site rollout.

### 2. Collect The Content Pack

For a managed site, the platform collects a structured content pack from the school. Typical inputs include:

- school name and short name
- logo and brand colors
- contact details and admissions contact
- school hours and address
- core admissions copy
- fees summary language
- visit and enquiry details
- approved calls to action
- any school-specific notes needed for launch

The content pack is the source of truth for launch. It is reviewed before the site is published.

### 3. Select The Template

Template selection is owned by the platform delivery team.

Recommended rule:

- the platform delivery lead picks the template from the approved library
- the school can express a preference and approve the direction
- the final choice stays with the platform team so the launch remains maintainable, accessible, and consistent with the shared system

If the school needs a more distinctive tone, the platform can still select a different shared template family or a premium service lane, but not a one-off code fork.

### 4. Build The Initial Site

The platform team maps the approved content pack into the template's existing page slots and publishes the site in a controlled state.

The launch should happen from a preview or managed host first when possible, then move to the canonical host once the school approves the content and domain state.

### 5. Approve Before Cutover

Before the first live launch, the school reviews:

- home page copy
- admissions copy
- contact details
- fee summary language
- page list and navigation order
- canonical hostname choice

The school approves factual content. The platform team approves the structure and technical launch.

---

## Editing Boundary Model

### Platform-Team-Managed

The platform team owns:

- template family selection
- page layout and section order
- canonical host and domain routing
- SEO defaults and metadata behavior
- default CTA structure
- page additions and supported future page rollout
- launch sequencing and cutover timing
- layout-level content presentation
- request triage for unusual changes

### School-Admin-Editable

The school admin can directly supply, approve, or request updates to factual content that already fits the current template contract, such as:

- school name presentation
- logo and brand colors
- address and contact details
- visit and enquiry details
- school factual updates that fit existing page slots

The school admin does **not** directly publish these changes in a self-serve editor yet. Instead, the school is the source of truth for the content, and the platform team applies the approved update through the managed workflow.

### Joint-Approval Content

These areas require a request-and-approval workflow rather than a direct school-admin edit:

- homepage hero wording
- admissions text and promise language
- fee summary framing
- school differentiators
- major call-to-action destinations

For those items, the school provides factual input and final approval, while the platform team owns the final wording, placement, and publication step.

### Not School-Editable Yet

The following remain platform-controlled for now:

- new page routes
- custom section ordering outside the template contract
- per-school visual components
- arbitrary layout edits
- direct live content editing in a freeform editor

That keeps the product from drifting into a full no-code builder.

---

## Change Request And Page Expansion Model

When a school needs a change, the request should be classified into one of four buckets:

1. **Copy update** - wording changes within an existing page slot
2. **Section update** - replacing or reordering content within the current template contract
3. **Reusable page addition** - a new page that could be promoted into the shared template library for other schools
4. **Custom managed exception** - a school-specific request that should only proceed if it fits the shared engine and the service lane allows it

### Rules For New Pages

- Prefer existing pages and slots first.
- If the new page is reusable across schools, add it to the shared template contract.
- If the page is school-specific and not reusable, treat it as a managed custom request, not a permanent platform pattern.
- Do not create a bespoke route or private rendering path for one school unless there is a strong maintainability reason and explicit service approval.

This keeps maintenance manageable while still allowing schools to expand their public presence.

### Recommended Triage Flow

1. School or delivery lead raises the change request.
2. Platform team classifies it as copy, section, reusable page, or custom exception.
3. The request is checked against the current template family and supported page set.
4. The change is either applied in the existing contract, added as a reusable extension, or declined/escalated to a premium/custom lane.
5. The site is re-approved and republished.

---

## External-Site Integration Model For Mode B Schools

For schools that keep their own website:

- the external site remains the school's primary public presence
- the platform provides minimum branded entry points only
- portal, staff/admin, and teacher access links stay available from the product surfaces
- the school's public marketing content remains owned by the school
- the platform does not force a public-site migration during operational onboarding

The minimum branded handoff should still include:

- school name and logo
- clear portal sign-in link
- staff/admin sign-in link
- teacher sign-in link when needed
- contact or payment handoff links where those workflows exist

Mode B is therefore a supported operating state, not a temporary failure state.

---

## Migration Path From External Site To Managed Site

A school should be able to move from its own website to a platform-built site without re-onboarding the school record.

Recommended path:

1. Keep the external website live while the school continues normal operations.
2. Collect the managed-site content pack and approvals.
3. Build the managed site on a platform-controlled or staging host.
4. Review and approve the site before any domain cutover.
5. Attach the school's custom public domain or platform-managed canonical host.
6. Redirect or retire the external site only after the managed site is stable.
7. Preserve links and search visibility as much as possible during the transition.

This is a public-web cutover, not a school re-onboarding event.

---

## Standard Vs Premium/Custom Website Service Lanes

### Standard

Best for schools that want a clean launch using the shared template library.

Includes:

- one of the approved template families
- core public pages only
- structured content pack entry
- limited revision rounds
- platform-managed launch and cutover

Boundary:

- no bespoke page builder
- no unlimited layout changes
- no one-off code paths

### Premium

Best for schools that want a more hands-on managed launch.

Includes:

- additional content polish
- more launch support
- more revision rounds
- extra reusable pages if they fit the shared engine
- stronger migration support from an existing site

Boundary:

- still uses the shared engine and template contract
- does not become a private CMS implementation

### Custom

Best for exceptional cases that need higher-touch delivery.

Includes:

- special handling for content structure or page rollout
- stronger coordination around launch timing
- non-standard public-web requirements that still fit the shared runtime

Boundary:

- custom is a service lane, not a new product architecture
- if a request cannot be expressed in the shared renderer, it should not become a hidden one-off codebase

---

## Relationship To Current Runtime

The current `apps/sites` implementation already provides:

- hostname resolution
- template selection
- page-slot composition
- domain canonicalization
- metadata and SEO output
- safe handling for unknown and inactive hosts

T23 sits above that runtime and defines how the sites are delivered, approved, expanded, and migrated.

It intentionally does not replace the existing template engine with a full editor.

---

## Regression Checks

- Do not blur the line between SchoolOS marketing in `apps/www` and the tenant public-site engine in `apps/sites`.
- Do not turn managed delivery into a self-serve page builder.
- Keep template ownership with the platform team.
- Keep school approval focused on factual content and launch readiness.
- Keep external-site schools fully supported in Mode B.
- Keep page expansion inside the shared template system wherever possible.
- Keep custom requests inside a service lane, not a separate codebase.

---

## Implemented Outcome

- The managed delivery workflow is now defined for onboarding and launch.
- The platform-team-managed vs school-admin-editable boundary is explicit.
- Change requests and page expansion are constrained to the shared engine.
- External-site schools are supported without forcing immediate migration.
- The Mode B to Mode C migration path is documented.
- Standard, premium, and custom delivery lanes are separated clearly.
- The policy stays aligned with T19-T22 and does not introduce a full no-code builder.
