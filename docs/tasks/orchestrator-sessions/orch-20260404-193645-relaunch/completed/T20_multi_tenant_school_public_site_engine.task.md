# T20 Multi-Tenant School Public-Site Engine Foundation

## Objective

Build the first dedicated tenant public-site engine in `apps/sites` so the school-facing website can resolve school context at runtime and render the correct branding/content/template without repo cloning.

## Why This Exists

The SchoolOS marketing site belongs in `apps/www`, but tenant school public websites need their own dedicated surface.

We need a reusable engine that can support many school public sites with one codebase.

## Requested Scope

- add runtime school resolution for public-site requests
- add school-aware branding/content loading instead of hardcoded values
- support both platform-managed school subdomains and custom public domains
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
- favicon behavior
- theme tokens
- contact details
- template selection key

### 3. Runtime Content Loading
- home/about/admissions/etc. content resolves by school context
- content no longer lives as one hardcoded single-school blob

### 4. Public-Site Rendering Contract
- one public-site app
- many schools
- request-time school resolution
- no repo clone per school for normal cases

## Acceptance Criteria

- [x] A school public request can resolve school context by hostname.
- [x] Branding and public-site content can switch at runtime by resolved school.
- [x] The public-site engine supports multiple schools in one deployment.
- [x] Unknown or inactive hostnames fail cleanly and safely.
- [x] The engine remains separate from platform marketing-site content.

## Notes

- This is the public-site runtime foundation task.
- Do not confuse this with school-admin editing UX or domain onboarding UX; those are follow-on tasks.
