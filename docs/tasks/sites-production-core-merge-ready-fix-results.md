# PR101 merge-ready correction results

Local code and tests only. No deploy, seed, remote query, provider mutation, commit or push. The task packet remains the scope boundary; the three defects behind five review threads are addressed. Parent must redeploy the corrected, backwards-compatible Convex backend before merging the browser and Admin proxy changes. The production backend currently registered from `989651ab` does not understand the new versioned headers.

## Changes and decisions

- `packages/convex/functions/sites/providerNode.ts`: parse Node-validated IPv6 through WHATWG canonicalization into eight numeric groups; admit `2000::/3` except `2001::/23` protocol/transition/benchmark allocations, `2001:db8::/32` and `3fff::/20` documentation, and `2002::/16` 6to4. IPv4 policy is unchanged. TLS pin comparison now compares numeric IPv6 addresses so expanded/compressed forms match. No caller-controlled pin, host, port, trust root or DNS answer was introduced.
- `apps/sites/proxy.ts`: bad path/query and admitted aliases that cannot redirect return a terminating 400 with no-store and noindex. Unavailable hosts still use the non-indexable pass-through; canonical hosts still render; valid alias query strings remain in 308 redirects. The proxy test calls the real proxy with a mocked admitted alias, then checks an unsafe query cannot render HTML.
- `packages/shared/src/site-upload-metadata.ts` and `packages/shared/package.json`: shared, versioned `x-site-filename-uri-v1` and `x-site-alt-uri-v1` codec. URI encoding is canonical ASCII; decoding occurs once, with length, control, malformed encoding and raw/encoded conflict checks. Raw legacy headers are accepted without decoding, so `100%.png` stays literal. The Admin browser upload sends encoded-only headers, the authenticated same-origin Admin proxy validates and forwards encoded-only headers (including legacy requests), and the Convex HTTP handler validates before storage. The internal storage mutation revalidates decoded metadata. Binary image cleaning, ownership, rights, child classification and publication checks remain intact.
- Tests cover Arabic, Chinese and Yoruba metadata in the in-process Convex HTTP handler and persisted asset rows, raw old-client percent literals, invalid/oversized/conflicting metadata, denied unauthenticated and wrong-school uploads, the browser's encoded header construction, Admin proxy forwarding, local TLS and numeric IPv6 pin normalization. Images are synthetic pixels.

## Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @school/convex exec vitest run functions/sites` | 11 files, 32 tests passed; includes a fresh headless Chromium synthetic bridge and local trusted TLS fixture. |
| `pnpm --filter @school/sites exec vitest run core` | 5 files, 13 tests passed. |
| `pnpm --filter @school/admin exec vitest run __tests__/site-upload-proxy.test.ts __tests__/site-management.test.tsx` | 2 files, 9 tests passed. |
| `pnpm --filter @school/shared test` | 36 files, 234 tests passed. |
| `pnpm --filter @school/convex typecheck`; `pnpm --filter @school/sites typecheck`; `pnpm --filter @school/admin typecheck`; `pnpm --filter @school/shared typecheck` | Passed. |
| `pnpm --filter @school/convex exec eslint functions/sites/providerNode.ts functions/sites/probe-local.test.ts functions/sites/assets.ts functions/sites/sites.test.ts functions/sites/domainRules.test.ts`; `pnpm --filter @school/shared exec eslint src/site-upload-metadata.ts` | Passed with no findings. |
| `pnpm --filter @school/sites lint`; `pnpm --filter @school/admin lint` | Passed: Sites has one existing first-party image warning; Admin has 89 warnings in unrelated files, zero errors. |
| `node /tmp/sites-convex-offline-esbuild-check.cjs` | Offline bundle preflight passed: 167 isolate entries, 286 outputs; 13 Node entries, 33 outputs. No remote Convex analysis. |
| `env CONVEX_URL='' CONVEX_SITE_URL='' NEXT_PUBLIC_CONVEX_URL='' NEXT_PUBLIC_CONVEX_SITE_URL='' SITES_GATEWAY_SECRET='' SITES_PRODUCTION_CUSTOM_HOSTS='' pnpm --filter @school/sites build` | Passed. |
| `env CONVEX_URL='' CONVEX_SITE_URL='' NEXT_PUBLIC_CONVEX_URL='https://synthetic.convex.cloud' NEXT_PUBLIC_CONVEX_SITE_URL='' SITES_GATEWAY_SECRET='' pnpm --filter @school/admin build` | Passed. Synthetic public URL is for compilation only, not a backend fixture. |
| `node scripts/audit-theme-colors.mjs`; `git diff --check` | Passed. Audit reports existing `red-700` in touched Admin settings UI; it is semantic error, not tenant branding. |

An initial Admin build with `NEXT_PUBLIC_CONVEX_URL=https://synthetic.invalid` compiled but failed prerender because Convex requires a `.convex.cloud`-shaped URL. The corrected synthetic compilation-only URL above passed. Initial focused test/typecheck failures from the draft IPv6 parser, missing proxy test fixture field and test typing were fixed before the final runs. Next's Admin build printed that it loaded `.env.local`; all relevant backend URL and gateway values were explicitly overridden for the build. No environment file was inspected, copied or logged by this task.

## Remaining limits

The headless test uses authenticated synthetic in-process functions and mocked provider observations. Local TLS tests use generated certificates. Offline bundling and compilation do not verify a deployed Convex/Vercel runtime. Backend redeploy must precede the frontend merge. No real school image, live identity, real provider, DNS or production upload was used.

Changed paths: `apps/admin/__tests__/site-management.test.tsx`, `apps/admin/__tests__/site-upload-proxy.test.ts`, `apps/admin/app/admin/settings/site/page.tsx`, `apps/admin/app/api/site-assets/upload/route.ts`, `apps/sites/core/proxy.test.ts`, `apps/sites/proxy.ts`, `packages/convex/functions/sites/assets.ts`, `packages/convex/functions/sites/domainRules.test.ts`, `packages/convex/functions/sites/probe-local.test.ts`, `packages/convex/functions/sites/providerNode.ts`, `packages/convex/functions/sites/sites.test.ts`, `packages/shared/package.json`, `packages/shared/src/site-upload-metadata.ts`, and this results file. The pre-existing untracked task packet was not edited.
