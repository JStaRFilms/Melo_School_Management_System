# B4 — Site core refactor and structured content loading

**Stage:** Build | **Role:** Coder | **Depends on:** B0, D3 | **Worktree:** `feature/obhis-public-site`

## Objective
Refactor `apps/sites` from its hard-coded template/content catalogue into a shared site core that resolves typed tenant content and dispatches to bespoke renderers.

## Scope
Host/domain resolution, renderer registry, typed content loading, preview/publish boundaries, canonical metadata/SEO, and application/portal link integration; no OBHIS visual implementation.

## Ownership
`apps/sites/**`, explicitly assigned content/domain admin surfaces, site tests/docs. Do not edit admissions domain code.

## Implement
- Preserve/improve host resolution, domain verification state, canonical redirects, `robots`, sitemap, metadata, and structured data.
- Replace the assumption that a school must choose a finite page template with a renderer registry/module contract and typed content payloads.
- Add safe content fetch/cache/publish/preview boundaries based on B0/D3; only approved structured fields may render.
- Add configurable application/portal link resolution using B0’s canonical contract, including external-site integration guidance.
- Maintain compatibility for existing demonstration tenants through migration/adapter code or explicitly reviewed replacement.

## Tests
Host/domain resolution, canonical redirect, missing/inactive tenant, renderer fallback, metadata/sitemap, unpublished content, and canonical application CTA tests.

## Done when
A new bespoke school renderer can be introduced without changing core host/domain code or granting a page-builder capability.
