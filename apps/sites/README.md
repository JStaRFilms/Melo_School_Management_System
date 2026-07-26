# Managed public-site core

`lib/core` owns hostname/domain safety, published/preview loading, canonical redirects, SEO, and B0 link consumption. Renderer modules are a compile-time registry; content may never provide a module path, route, script, application origin, or redirect URL.

## Deployment boundary

Production managed tenants require a server-to-server B0 public-projection endpoint in `SITE_PUBLIC_CONTENT_ENDPOINT`. It must return the validated published profile/revision/domain/asset/link envelope consumed by `parsePublicSiteEnvelope`. Public projections are deliberately fetched with `no-store`: publication pointers and application availability are mutable and must update immediately after a close, publish, or revert. Draft preview additionally requires `SITE_PREVIEW_CONTENT_ENDPOINT`; it receives an opaque preview token and must authenticate/authorize it server-side, bind it to the hostname/revision, and return `preview.authorized: true` with an expiry. Preview may use a pending domain, is no-index, retains its `/__preview/{token}` navigation prefix, and never redirects to canonical. Missing or invalid projections fail closed.

The public envelope must bind `links.application.schoolSlug` exactly to `profile.schoolSlug`; publication state, revision state, canonical domain, and active aliases are all fail-closed. The only fallback is `legacy-template`, an explicit compatibility adapter for Greenfield and Aster demo tenants. It is not a B0 data seed, does not include OBHIS, and should be removed after those demos are migrated to published revisions.

External and no-site schools do not acquire a managed hostname. Their own website/directory consumes the B0 `ApplicationLinkV1` directly; `getPublicLinkIntegration` keeps the same canonical application/optional portal projection for `managed`, `external`, and `none` modes.

## B5 renderer contract

Register one reviewed descriptor in `lib/core/renderers/registry.ts` implementing `SiteRenderer<TData>` from `lib/core/renderers/contract.ts`. It must use a fixed `key`, fixed `schemaVersion`, fixed `routes`, and a validator that converts only the internal typed validation-field input into `TData`; `render(context)` never receives raw fields. Dynamic routes are compile-time patterns (for example `/policies/[policySlug]`); `context.request.params` contains their decoded values, and `sitemapPaths(data)` may return only concrete paths matching a declared pattern. `render(context)` receives validated `SiteRenderContext<TData>` from `lib/core/contracts.ts`; it must use `context.links.application.href` only via `applicationCtaHref`, never construct an Apply/Portal URL, and must not query data, inspect hosts, load drafts, or inject scripts. Unknown key/version, invalid data, inactive domains, or missing approved content never select another renderer.

## Compatibility and verification

`legacy-template` may provide code-owned presentation metadata through its renderer hook only. Greenfield/Aster metadata, JSON-LD, manifest colours/names, and favicon are derived from their quarantined typed compatibility projection; a generated school-mark data icon is used only when that projection has no uploaded favicon. There is no global/platform favicon fallback.

`pnpm --filter @school/sites test:browser` runs Chromium against an ephemeral test-only approved projection. It covers preview aliases, unavailable routes, keyboard dialog focus/return, 320px effective reflow, overflow, and palette contrast. It does **not** claim production Lighthouse/CWV results. Production CWV evidence requires the approved B0 projection endpoint, rights-cleared responsive derivatives (`width`, `height`, and `responsiveSources`), and an approved published OBHIS tenant/domain; no substitute OBHIS content or asset is supplied by this repository.

## B0 projection lifecycle

Configure `SITE_PUBLIC_CONTENT_ENDPOINT` to Convex's `/site-public-projection` endpoint and `SITE_PREVIEW_CONTENT_ENDPOINT` to `/site-preview-projection`. The public endpoint accepts a normalized hostname and returns only that hostname's immutable published revision. The preview endpoint accepts `{ hostname, previewToken }`; Convex hashes the token before lookup and rejects it unless its stored capability is unrevoked, unexpired, and bound to the same hostname and draft revision. These responses are always `no-store`.

`requestDomain` atomically claims a normalized hostname before it can be used by another tenant. `setCanonicalDomain` atomically selects one active canonical host and changes every other active school host into a reference-bound alias. A site publisher saves a bounded draft with optimistic `expectedDraftVersion`, then `publishDraft` copies it to a new immutable published revision. `revertPublishedRevision` copies history into a new draft rather than changing history. Referenced assets must be published, rights-approved, unexpired, and carry the B0 kind/purpose/channel projection; social metadata accepts only a `social_share` asset approved for that channel. Managed revisions select `brand.logo` and `brand.favicon` explicitly. Non-legacy routes need distinct complete route metadata before sitemap indexability.

`x-forwarded-host` is ignored unless `SITE_TRUST_PROXY=true`, or in non-production only when `SITE_TRUST_FORWARDED_HOST=true`. Do not enable either value without a proxy that strips client-supplied forwarded headers.
