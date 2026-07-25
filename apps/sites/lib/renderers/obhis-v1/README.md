# `obhis-v1` renderer

This is a compiled, code-controlled renderer. It accepts only the B4 `SiteRenderContext` and is registered under `obhis-v1` / schema version `1`.

## Approved semantic fields

The renderer validates the following bounded field IDs. A field absent from a published B4 revision is omitted; no historic booklet value, demo value, fee, contact, programme, policy, or asset is substituted.

- Identity: `identity.displayName` (required), `identity.shortName`, `identity.motto`, `brand.logo`.
- Home: `home.hero.eyebrow`, `home.hero.heading`, `home.hero.summary`, `home.hero.asset`, `home.values.lead`.
- About: `about.lead`, `about.values.ids`, `about.values.{id}.title/body`, `about.story.ids`, `about.story.{id}.title/body`.
- Programmes: `programmes.ids`, `programmes.{slug}.name/descriptor/summary/asset`.
- Admissions: `admissions.lead`, `admissions.steps`, `admissions.questionsCopy`.
- School life: `schoolLife.lead`, `schoolLife.gallery`, `schoolLife.features.ids`, `schoolLife.features.{id}.title/body`.
- Contact/visit: `contact.phone`, `contact.email`, `contact.address`, `contact.hours`, `contact.directions`, `visit.lead`.
- Policies: `policies.ids`, `policies.{slug}.title/summary/issued/reviewed/asset`.

The B4 publication gate and `OBHISContentApprovalSheet.md` remain the approval ledger for every factual field and asset. In particular, the current sheet leaves identity, brand, programmes, contacts, policies, portal approval, application availability, and photographic assets blocked for production publication.

## Safety boundaries

`/apply` is not in the route manifest. Apply buttons use `applicationCtaHref(context.links.application)` and portal links appear only from `context.links.portal`. Asset rendering accepts only the B4 public asset projection, requires an alt text unless decorative, and omits unknown/missing references. No content field can choose a component, route, URL origin, script, or HTML.

The renderer has no photo, contact, fee, policy, or school-fact fixture. Its non-photographic hero and school-life panels are deliberate visual fallbacks while approvals are incomplete.

## B6 handoff

Before release, connect an approved B0 public projection for an OBHIS managed profile and complete the approval ledger. B6 should also add a renderer route-availability predicate to site core: the current compiled dynamic matcher can reach `/policies/[policySlug]` for an unknown slug, where this renderer returns the unavailable state, but core cannot yet mark that unknown dynamic path `noindex`. The predicate must run before metadata generation so only a validated policy slug is indexable. For stronger responsive-image performance, extend the approved public asset projection with width, height, and focal-point data; B5 currently reserves layout with CSS but cannot emit source dimensions.
