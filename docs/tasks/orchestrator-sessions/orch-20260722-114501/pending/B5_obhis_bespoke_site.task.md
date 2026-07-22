# B5 — OBHIS bespoke public site

**Stage:** Build | **Role:** Coder | **Depends on:** B4, D2 | **Worktree:** `feature/obhis-public-site`

## Objective
Implement OBHIS as the first code-controlled bespoke renderer consuming the shared site-core contract.

## Scope
OBHIS-specific renderer, approved content/assets, responsive pages, SEO/accessibility, and canonical admissions/portal CTAs; no generic site-core or admissions-domain changes.

## Ownership
OBHIS renderer/module, approved content seed/configuration, assets that have verified usage rights, site-specific tests/docs.

## Implement
- The approved responsive sitemap, visual direction, pages, navigation, CTAs, structured data, metadata, accessibility behavior, and performance budget from D2.
- Admissions CTA to B0’s canonical public application URL, plus a portal link only where approved.
- Content preview/publish behavior supplied by B4, without allowing the admin to alter renderer layout.
- Clearly labelled/omitted placeholders for any missing approved brand asset, copy, fee, contact, programme, or photo; never invent final facts.

## Verification
Test desktop/mobile layouts, keyboard navigation, contrast/alt text, no unapproved claims, metadata/canonical URLs, application linking from OBHIS domain, and performance against the agreed budget.

## Done when
OBHIS feels school-specific rather than a selected theme, has a documented approval log for every factual claim/asset, and does not make the admissions funnel depend on this renderer.
