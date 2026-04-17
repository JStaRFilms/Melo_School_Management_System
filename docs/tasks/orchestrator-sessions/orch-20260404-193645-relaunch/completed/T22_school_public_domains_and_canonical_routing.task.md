# T22 School Public Domains and Canonical Routing

## Objective

Support school public websites on both platform-managed subdomains and school-owned custom public domains, with safe DNS onboarding, canonical routing, and school-specific SEO output.

## Why This Exists

School public sites need a production-ready domain model.

We want to support staged rollout:
- first on platform subdomains such as `greenfield.meloschool.com`
- later on school-owned domains such as `obhis.com`

This should not require repo cloning or separate deployments.

## Requested Scope

- add school public-domain mapping records
- support platform subdomain mode first
- support custom-domain onboarding and verification
- support canonical-host rules for public pages
- make public metadata/robots/sitemap/structured data school-aware by domain

## Domain Cases to Support

### Case 1 — Platform-Managed Public Subdomain
- `{schoolSlug}.meloschool.com`
- easiest first rollout

### Case 2 — School-Owned Custom Public Domain
- `obhis.com`
- `greenfieldacademy.ng`
- school manages DNS; we provide records/instructions and verification

## Required Capabilities

- `schoolDomains`-style mapping records
- hostname -> school resolution
- verification token / DNS readiness flow
- status tracking:
  - pending
  - verified
  - active
  - ssl-ready/failed
- canonical redirect rules where needed
- school-specific SEO output using the active/canonical domain

## Acceptance Criteria

- [ ] A school can run on a platform-managed public subdomain.
- [ ] A school can later attach its own custom public domain.
- [ ] DNS onboarding is supportable through configuration and verification, not code edits.
- [ ] Canonical URLs and metadata resolve correctly per school domain.
- [ ] Public sitemap and robots outputs remain school/domain correct.

## Notes

- Keep authenticated apps canonical on product-owned hosts at first, per the topology note.
- This task is about public-site domains, not cross-root authenticated subdomains.
