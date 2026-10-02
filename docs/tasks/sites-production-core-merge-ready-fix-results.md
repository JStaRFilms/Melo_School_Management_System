# PR101 merge-ready correction results

## Late DNS endpoint readiness correction (PR head `5c09ceeb`)

Late review thread `PRRT_kwDORvwFBc6oO2AJ` (finding `4162983649`) correctly found that `probeTls` checked only the first of up to 32 validated A/AAAA answers. The local correction makes every resolved public address pass the existing pinned HTTPS/TLS probe at port 443 with the exact hostname/SNI, trusted leaf, and fixed deployment marker. `probeResolvedTlsEndpoints(ips, probe)` is an ordinary unregistered helper used by production only after DNS public-address validation. It permits mocked endpoint transports in tests, but no Convex action accepts a caller-provided IP, port, CA, or probe function. It starts at most four endpoints per batch, waits for all in-flight endpoints before reporting a batch failure, and does not start later batches after failure. On success it keeps the first validated leaf fingerprint as representative and stores the earliest leaf expiry across all endpoints. Distinct individually valid renewed certificates need not share a fingerprint; the existing endpoint probe still compares each HTTPS connection against its own TLS handshake. The DNS 32-answer cap, reserved-address rejection, pinning, deadlines, redirect denial, and response byte limit remain unchanged.

Mocked mixed A/AAAA endpoints, a rejected second address, earliest expiry and bounded concurrency are covered in `probe-aggregate.test.ts`. Controlled local TLS endpoints also deny near-expiry and wrong-marker second peers; existing fixture tests cover trust/SNI, certificate changes between handshake and HTTP, and time/byte/redirect limits. No DNS/provider/backend request was made by these tests.

| Verification command | Result |
| --- | --- |
| `pnpm --filter @school/convex exec vitest run functions/sites/probe-aggregate.test.ts functions/sites/probe-local.test.ts functions/sites/probe.test.ts functions/sites/domainRules.test.ts` | 4 files, 16 tests passed. |
| `pnpm --filter @school/convex exec vitest run functions/sites` | 12 files, 35 tests passed, including the in-process authenticated headless bridge; the passing bridge printed a non-fatal WebSocket port-in-use warning. |
| `pnpm --filter @school/convex typecheck` | Passed. |
| `pnpm --filter @school/convex exec eslint functions/sites/providerNode.ts functions/sites/probe-aggregate.test.ts functions/sites/probe-local.test.ts` | Passed. |
| `node /tmp/sites-convex-offline-esbuild-check.cjs`; `git diff --check` | Passed. Offline esbuild: 167 isolate entries/286 outputs and 13 Node entries/33 outputs; not remote Convex analysis. |

The verified code is local only. Production still runs the previously deployed `b1684800` backend and remains vulnerable to a bad second DNS endpoint until the owner redeploys this correction. No deploy, seed, commit, push, live DNS/provider query, or real photo operation was performed in this pass.

## Earlier merge-ready corrections (historical local results)

The following records the earlier local correction pass, before the `b1684800` deployment documented in `sites-production-core-rollout.md`. Its three defects behind five review threads were addressed without a deploy in that pass. The older `989651ab` backend did not understand the new versioned headers; production later received the corrected `b1684800` backend.

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
