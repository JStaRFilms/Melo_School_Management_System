# Public School Domain Routing and SEO

## Goal

Support school public websites on both platform-managed subdomains and school-owned custom public domains, with safe domain-mapping records, verification readiness state, canonical routing, and school/domain-aware SEO output.

## Scope

This feature covers the public-school site surface in `apps/sites` only.

It includes:

- domain-mapping records for public school sites
- platform-managed public subdomains
- school-owned custom public domains
- verification tokens and DNS readiness state
- canonical host selection and safe redirect behavior
- school-aware metadata, robots, sitemap, and structured data output

It does not include:

- SchoolOS product marketing in `apps/www`
- admin, teacher, portal, or auth subdomains
- cross-root authenticated session handoff
- managed editing workflows or page authoring beyond domain routing

## Domain Model

The public-site runtime models domains as records instead of a flat hostname list.

Each record carries:

- hostname
- surface
- kind
- status
- readiness
- SSL readiness
- canonical intent
- school-managed DNS posture
- verification token or manual instructions
- optional redirect target

### Supported States

- `pending` - the domain exists, but DNS verification is still in progress
- `verified` - DNS ownership is proven, but the domain may still be waiting on SSL or activation
- `active` - the domain is live and can serve public pages

### Readiness Signals

- `dns_pending` - the school still needs to add the required record
- `dns_verified` - DNS ownership has been confirmed
- `ssl_pending` - verification passed but SSL is still being provisioned
- `ready` - the domain can serve as an active public host

## Canonical Routing

- Every school can have multiple domain records.
- Exactly one active public host should act as the canonical target when possible.
- Non-canonical active hosts should redirect safely to the canonical host.
- Unknown, inactive, or not-yet-active hosts must fail safely.

The route layer resolves the request hostname, finds the school domain record, and then derives the canonical public origin from the active canonical domain.

## SEO Outputs

The public-site engine emits school/domain-aware SEO output from the active canonical host:

- metadata canonical URLs
- open graph URLs
- JSON-LD structured data
- robots.txt rules
- sitemap.xml entries

Sitemap entries are built from the visible school pages for the active canonical domain only.

Robots output disallows unknown or inactive hosts and advertises the canonical sitemap for active schools.

## Implementation Notes

- The in-app domain registry is intentionally config-driven so the same model can later move into Convex records.
- Platform-managed subdomains and custom domains share the same resolution path.
- Canonical redirects are handled centrally rather than by route-specific hacks.
- The public-site app remains separate from `apps/www`.

## Completed Outcome

- Platform-managed public subdomains are supported.
- Custom public domains can be modeled as pending, verified, or active.
- Canonical redirects and canonical metadata use the active host.
- Robots, sitemap, and structured data are domain-aware.
- Safe fallbacks protect unknown and inactive hosts.
