# Multi-Tenant Domain And Auth Topology 2026-04-12

## Goal

Define a production-ready hosting, domain, and authentication model for turning the current monorepo into a real multi-tenant SaaS without cloning the repo or running a separate deployment per school.

This note captures the intended target state for:

- product-owned subdomains such as `platform.meloschool.com`
- school public sites on either platform subdomains or school-owned custom domains
- optional school-owned role subdomains such as `admin.obhis.com` and `students.obhis.com`
- runtime branding and template switching based on resolved school context
- school-managed DNS onboarding without requiring the platform to purchase domains on the school's behalf

---

## Why This Exists

- `FR-001` requires tenant-aware school setup and white-label behavior.
- `FR-002` requires sign-in flows that work across app surfaces.
- `FR-011` requires public websites that can later support custom domains.
- Current ADRs establish shared auth and soft multi-tenancy, but they do not fully define the domain-routing and cross-domain session strategy.

This file is the implementation reference for that missing layer.

---

## Core Decision

Use **one monorepo, one shared Convex backend, one tenant-aware application stack**, and resolve school identity at runtime through configuration.

Do **not** clone the repo or spin up a full separate instance per school for normal white-label use cases.

Per-school customization should be handled by:

- school records
- domain mapping records
- branding/theme config
- template selection config
- runtime hostname resolution

Separate deployments should only be considered for schools that require custom code, contractual isolation, or infrastructure isolation beyond normal SaaS tenancy.

---

## Supported Topologies

### 1. Product-Owned Canonical SaaS Topology

Example:

- `meloschool.com`
- `platform.meloschool.com`
- `admin.meloschool.com`
- `teacher.meloschool.com`
- `portal.meloschool.com`
- `greenfield.meloschool.com` for a school public site

Use this as the **default and easiest** operating mode.

Properties:

- simplest DNS and SSL setup
- easiest shared-cookie behavior across authenticated surfaces
- easiest internal support and rollout path
- best default for v1 and multi-school growth

### 2. School Custom Public Domain Only

Example:

- `obhis.com` serves the school's public website
- authenticated surfaces remain on product-owned hosts such as:
  - `admin.meloschool.com`
  - `teacher.meloschool.com`
  - `portal.meloschool.com`

Use this as the **recommended white-label model** for most schools.

Properties:

- public site is fully branded on the school's own domain
- authenticated apps stay operationally simple
- school context is resolved after login from membership, not from hostname alone
- avoids complex cross-root cookie sharing problems

### 3. School-Owned Root Plus School-Owned Role Subdomains

Example:

- `obhis.com`
- `admin.obhis.com`
- `teacher.obhis.com`
- `students.obhis.com` or `portal.obhis.com`

This should be supported, but treated as an **advanced topology**.

Properties:

- school gets a fully white-labeled hostname set
- cookies can be shared across `*.obhis.com`
- cross-domain SSO with product-owned hosts is no longer cookie-native
- requires a more deliberate auth authority and session bootstrap flow

### 4. School Already Has DNS And Wants Us To Work With It

Example:

- school owns the registrar
- school manages Cloudflare or another DNS provider
- school adds CNAME, A, or TXT records we provide

This is fully compatible with the model in this document.

The platform should support **config-driven onboarding**, not registrar ownership.

---

## Recommended Default Strategy

For the main product:

- keep authenticated apps canonical on product-owned subdomains
- allow public websites on either school custom domains or platform-managed school subdomains
- resolve school branding and data scope from membership context after sign-in

Why this is the preferred baseline:

- shared auth across `*.meloschool.com` is much simpler
- support tooling and redirects stay predictable
- parent accounts that may span multiple schools remain manageable
- schools still get white-label public presence without forcing the hardest auth topology everywhere

Advanced mode can later support school-owned role subdomains when a school explicitly wants:

- `admin.theirdomain.com`
- `teacher.theirdomain.com`
- `students.theirdomain.com`

---

## Auth Model

## Shared-Subdomain Behavior

Users can stay signed in across sibling subdomains **when those subdomains share the same registrable root domain** and the auth cookie is intentionally configured for that root.

Example:

- `admin.meloschool.com`
- `teacher.meloschool.com`
- `portal.meloschool.com`

This is the straightforward shared-session case.

## Cross-Root Behavior

Cookies are **not** shared natively between unrelated roots such as:

- `admin.meloschool.com`
- `admin.obhis.com`

That means a school using its own role subdomains cannot rely on simple cookie reuse from the product domain.

For that topology, the system should use a centralized auth authority plus redirect-based session bootstrap.

Recommended target:

- canonical auth authority on a stable product-owned host such as `auth.meloschool.com`
- each app host redirects unauthenticated users to that authority
- after successful sign-in, the auth authority returns the user with a signed, short-lived handoff
- target host establishes its own local session for that domain family

This gives us:

- cross-host sign-in orchestration
- compatibility with school-owned domain families
- no need for separate auth stacks per school

---

## White-Label And Template Model

Branding and template selection must be runtime-configurable.

The application should be able to hot-swap at request time:

- school name
- logo and favicon
- color tokens
- typography pack
- content sections for the public site
- selected public-site template
- selected report-card template
- later, optional portal/admin skin variants

This must happen from configuration and resolved school context, not from duplicated code.

---

## Components

### Client

- hostname-aware bootstrapping for public site requests
- school context provider for authenticated surfaces
- runtime theme token injection
- template renderer chosen by `templateKey`
- workspace switcher that understands canonical product subdomains and optional school-owned subdomains

### Server

- hostname resolver
- domain verification and onboarding flows
- canonical redirect rules
- auth authority and handoff endpoints
- school membership resolution after Better Auth session lookup
- school branding/template loaders

### Backend / Data

- one shared Convex deployment
- school-scoped data boundaries remain keyed by `schoolId`
- domain mapping records connect hostnames to schools and surfaces
- branding/template config records drive runtime rendering

---

## Data Flow

### 1. Public Request Resolution

```text
1. Request arrives with hostname
2. Server resolves hostname to a school + surface
3. School branding and template config are loaded
4. Matching public-site template renders
5. Canonical URL rules are applied if needed
```

### 2. Authenticated Request On Product-Owned Subdomains

```text
1. User visits admin/teacher/portal host under meloschool.com
2. Shared auth session is checked
3. Viewer membership is resolved from Better Auth + Convex
4. Current school context is selected
5. App renders with that school's branding and permissions
```

### 3. Authenticated Request On School-Owned Role Subdomains

```text
1. User visits admin.obhis.com or students.obhis.com
2. Local host checks for a valid session for that domain family
3. If missing, redirect to auth.meloschool.com
4. Auth authority validates identity and membership
5. Auth authority redirects back with a signed bootstrap payload
6. Target host establishes its own session
7. App renders with resolved school branding and permissions
```

### 4. Domain Onboarding For A School-Owned Domain

```text
1. Platform admin or school admin adds desired hostname
2. System creates a pending domain mapping and verification token
3. School updates DNS records at their registrar/DNS provider
4. Platform verifies DNS ownership and readiness
5. Hostname is marked verified and active
6. Requests to that hostname begin resolving to the mapped school + surface
```

---

## Database Schema

The current `schools` record is not enough by itself for this feature. Add explicit domain and branding structures.

### Extend `schools`

Recommended additions:

```typescript
schools: {
  name: string
  slug: string
  status: "pending" | "active" | "suspended"
  logoStorageId?: Id<"_storage">
  faviconStorageId?: Id<"_storage">
  defaultTemplateKey?: string
  defaultThemeKey?: string
  themeTokens?: Record<string, string>
  supportContactEmail?: string
  createdAt: number
  updatedAt: number
}
```

### Add `schoolDomains`

```typescript
schoolDomains: {
  schoolId: Id<"schools">
  hostname: string
  surface: "public" | "admin" | "teacher" | "portal" | "auth"
  kind: "platform_subdomain" | "custom_domain" | "school_subdomain"
  isPrimary: boolean
  isCanonical: boolean
  redirectToHostname?: string
  verificationMethod: "txt" | "cname" | "manual"
  verificationToken?: string
  isVerified: boolean
  sslStatus: "pending" | "ready" | "failed"
  dnsManagedBySchool: boolean
  createdAt: number
  updatedAt: number
}
```

### Add `schoolBrandingProfiles`

```typescript
schoolBrandingProfiles: {
  schoolId: Id<"schools">
  templateKey: string
  publicSiteVariant: string
  reportCardVariant: string
  portalVariant?: string
  adminVariant?: string
  teacherVariant?: string
  themeTokens: Record<string, string>
  contentVersion?: string
  createdAt: number
  updatedAt: number
}
```

This keeps domain resolution separate from school identity and separate from visual configuration.

---

## Routing Rules

### Public Site

- one school can have multiple inbound public hostnames
- one hostname maps to one school and one surface
- one public hostname is marked canonical
- all non-canonical public hostnames may either render directly or redirect to canonical, based on product policy

### Authenticated Surfaces

- canonical product-owned subdomains remain valid for every school
- optional school-owned role subdomains may map to the same underlying surfaces
- school identity for authenticated requests should be resolved from membership context first, not hostname alone
- hostname can still influence branding and entry routing

---

## DNS Onboarding Policy

The platform should support both:

- domains purchased and managed by the platform
- domains purchased and managed by the school

For school-managed DNS:

- we provide the required record values
- the school adds them in their DNS provider
- we verify them from the platform

The platform does not need to own the registrar account.

---

## Operational Guardrails

- no repo clone per school for standard white-label needs
- no separate Convex deployment per school for standard tenancy
- no hostname-only authorization; authorization remains membership-driven
- cross-school data isolation still depends on `schoolId` checks in Convex
- parent multi-school access must remain possible even if hostname branding differs

---

## Current Repo Gap Summary

The current codebase already supports:

- one shared backend
- school-scoped data
- school slug
- basic school logo branding

The current codebase does not yet fully implement:

- hostname-to-school mapping
- domain verification records
- cross-root auth handoff
- full runtime branding packs
- runtime template switching by domain
- production-ready workspace URL rules for true subdomain deployment

---

## Recommended Implementation Order

1. Add schema for domain mappings and richer branding config.
2. Build hostname resolver for public requests.
3. Support custom domains for public sites first.
4. Keep authenticated apps canonical on `*.meloschool.com`.
5. Add runtime branding resolution across authenticated apps.
6. Add centralized auth authority and cross-root session bootstrap.
7. Enable school-owned role subdomains as an advanced option.

---

## Definition Of Done

- A school can run on a platform-managed public subdomain without custom code.
- A school can attach its own public domain through config and DNS verification.
- Branding and template selection switch at runtime based on school context.
- Authenticated apps work on canonical product subdomains with shared sign-in.
- The architecture has a defined path for school-owned role subdomains.
- No normal tenant onboarding requires a new repo clone or full separate deployment.
