# T20 Multi-Tenant School Public-Site Engine Foundation

## Objective

Turn the current `apps/www` single-school-style implementation into a true multi-tenant school public-site engine that can resolve school identity at runtime and render the correct school branding/content/template without repo cloning.

## Why This Exists

Right now `apps/www` is a real public site, but it still behaves like one school website with hardcoded placeholder branding/content.

We need a reusable engine that can support many school public sites with one codebase.

## Requested Scope

- add runtime school resolution for public-site requests
- add school-aware branding/content loading instead of hardcoded `site.ts` values
- support both platform-managed school subdomains and future custom public domains
- keep the engine separate from platform marketing-site concerns
- keep authenticated apps separate from this runtime unless a later advanced topology explicitly changes that

## Required Capabilities

### 1. Hostname Resolution
- inspect inbound hostname
- resolve hostname to school + surface
- fail safely on unknown or inactive hostnames

### 2. Runtime Branding
- school name
- logo
- favicon
- theme tokens
- contact details
- template selection key

### 3. Runtime Content Loading
- home/about/admissions/etc. content should no longer be hardcoded in one file for one school
- content should resolve by school context

### 4. Public-Site Rendering Contract
- one public-site app
- many schools
- request-time school resolution
- no repo clone per school for normal cases

## Suggested Data Structures

Use the direction already captured in the domain/auth topology note, such as:
- richer `schools` config
- `schoolDomains`
- `schoolBrandingProfiles`
- later `schoolPublicContent` or equivalent

## Acceptance Criteria

- [ ] A school public request can resolve school context by hostname.
- [ ] Branding and public-site content can switch at runtime by resolved school.
- [ ] The public-site engine supports multiple schools in one deployment.
- [ ] Unknown or inactive hostnames fail cleanly and safely.
- [ ] The engine remains separate from platform marketing-site content.

## Notes

- This is the public-site runtime foundation task.
- Do not confuse this with school-admin editing UX or domain onboarding UX; those are follow-on tasks.
