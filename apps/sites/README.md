# Managed public-site core

`lib/core` owns hostname/domain safety, published/preview loading, canonical redirects, SEO, and B0 link consumption. Renderer modules are a compile-time registry; content may never provide a module path, route, script, application origin, or redirect URL.

## Deployment boundary

Production managed tenants require a server-to-server B0 public-projection endpoint in `SITE_PUBLIC_CONTENT_ENDPOINT`. It must return the validated published profile/revision/domain/asset/link envelope consumed by `parsePublicSiteEnvelope`. Draft preview additionally requires `SITE_PREVIEW_CONTENT_ENDPOINT`; it receives an opaque preview token and must authenticate/authorize it server-side, bind it to the hostname/revision, and return `preview.authorized: true` with an expiry. Missing or invalid projections fail closed.

The only fallback is `legacy-template`, an explicit compatibility adapter for Greenfield and Aster demo tenants. It is not a B0 data seed, does not include OBHIS, and should be removed after those demos are migrated to published revisions.

External and no-site schools do not acquire a managed hostname. Their own website/directory consumes the B0 `ApplicationLinkV1` directly; `getPublicLinkIntegration` keeps the same canonical application/optional portal projection for `managed`, `external`, and `none` modes.

## B5 renderer contract

Register one reviewed descriptor in `lib/core/renderers/registry.ts` implementing `SiteRenderer<TData>` from `lib/core/renderers/contract.ts`. It must use a fixed `key`, fixed `schemaVersion`, fixed `routes`, and a validator that converts only `SiteRenderContext.fields` into `TData`. Dynamic routes are compile-time patterns (for example `/policies/[policySlug]`); `context.request.params` contains their decoded values, and `sitemapPaths(data)` may return only concrete paths matching a declared pattern. `render(context)` receives validated `SiteRenderContext<TData>` from `lib/core/contracts.ts`; it must use `context.links.application.href` only via `applicationCtaHref`, never construct an Apply/Portal URL, and must not query data, inspect hosts, load drafts, or inject scripts. Unknown key/version, invalid data, inactive domains, or missing approved content never select another renderer.
