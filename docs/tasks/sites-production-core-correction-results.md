# Sites correction pass results

Status: local correction pass and the in-process browser acceptance test completed. This is not live launch clearance. No commits, pushes, deployment, remote codegen, seed, DNS change or real provider POST occurred.

## Corrections

- Publication now selects independent current fact evidence and the exact pointed rights/consent evidence. Child applicability uses the latest explicit matching classification and independent reviewer; a changed classification clears the consent pointer. The school-only domain projection hides drafts, assets and publication history. The Admin child selector starts blank and cannot submit unselected.
- Provider attach/verify checks the exact fresh authoritative school TXT before POST. A transaction reserves the hostname write before the external call. An in-flight or uncertain result disables public readiness and blocks another write, rotation, suspension, retirement and activation. An interrupted write needs a 30-second wait, operator auth and positive read-only production-project confirmation to clear. A negative or ambiguous provider result remains blocked. Provider `http` routing is denied.
- Upload decodes bounded PNG/JPEG pixels with pure-JavaScript libraries, then stores a new PNG without ancillary metadata. WebP is denied. The stored checksum and evidence keys use hex, with strict base64/hex storage-metadata normalization. Upload tests cover both formats, metadata removal, polyglot/trailing bytes, truncation, dimensions and wrong digest.
- The HTTPS probe has a total deadline, socket cleanup and controlled local TLS tests for CA trust, hostname/SNI, short expiry, changed fingerprint, redirects, oversized responses, wrong marker and slow trickle. The Sites gateway accepts only a Host on the deployment-owned exact custom-host list. Greenfield `localhost` aliases are development-only.
- Schema coverage fingerprint and the approved optional school-domain provider-operation column were updated. No new provider table or automatic retry was added.

## Domain onboarding follow-up

The operator-only `getRoutingInstructions` action now reads the exact attached production project domain, bounded production list and Vercel v6 config without requiring provider verification, configured routing or TLS. It returns sanitized TXT verification challenges and sorted, bounded CNAME/IPv4 recommendations. It makes no readiness observation. The attach POST parser preserves TXT challenges in its response, but the platform directs the operator to fetch authoritative instructions afterward. The platform displays record owner, type, rank and value before readiness; attach feedback distinguishes an accepted response from verification. The operator guide and domain handoff now describe the school TXT, authorized attach, instruction fetch, DNS owner changes, optional separate verify POST, then readiness and activation sequence. No apex IP is hard-coded.

Offline verification for this follow-up: `pnpm --filter @school/convex typecheck` and `pnpm --filter @school/platform typecheck` passed. Focused Vitest command `pnpm --filter @school/convex exec vitest run functions/sites/provider-instructions.test.ts functions/sites/providerActions.test.ts functions/sites/browser-bridge.test.ts` passed 3 files, 5 tests. It includes pending-provider recommendations with readiness denial, wrong-project and custom-environment refusal, invalid record refusal, and the browser action fetching instructions before any readiness check. Vite printed its non-failing WebSocket port-in-use warning. Focused Convex and Platform ESLint passed without output. The full `pnpm --filter @school/convex exec vitest run functions/sites` suite passed 10 files, 28 tests, with the same non-failing Vite warning. `node scripts/audit-theme-colors.mjs` and `git diff --check` passed. Provider GET and POST responses in these tests are mocked; no live Vercel or DNS calls occurred.

## Verification

All checks below used synthetic values and local or mocked network only.

| Command | Result |
| --- | --- |
| `pnpm --filter @school/shared exec vitest run src/site-manifests.test.ts src/__tests__/admissions-foundation.test.ts` | 2 files, 7 passed |
| `pnpm --filter @school/convex exec vitest run functions/sites schemaCoverage.test.ts functions/foundation` | 12 files, 38 passed; this includes 5 local TLS fixture tests, a real convex-test readiness action with mocked external observations, and actual reservation/POST-failure action paths with mocked provider calls |
| `pnpm --filter @school/sites exec vitest run core` | 4 files, 10 passed |
| `pnpm --filter @school/admin exec vitest run __tests__/site-management.test.tsx __tests__/site-upload-proxy.test.ts` | 2 files, 5 passed |
| `pnpm --filter @school/{shared,convex,sites,admin,platform} typecheck` | Each package passed when run individually |
| `pnpm --filter @school/convex exec eslint functions/sites/*.ts` | Passed with no output |
| `pnpm --filter @school/sites lint` | Passed, 1 existing first-party image warning |
| `pnpm --filter @school/admin lint` | Passed, 89 warnings in other existing Admin files, no errors |
| `pnpm --filter @school/platform lint` | Passed, 6 existing warnings in other Platform files, no errors |
| `pnpm --filter @school/sites build`; `pnpm --filter @school/platform build` | Passed; Platform printed its existing missing public Convex URL preview-mode warning |
| `NEXT_PUBLIC_CONVEX_URL=https://sites-test.convex.cloud pnpm --filter @school/admin build` | Passed compile/prerender without network calls. The earlier attempt with `https://sites-test.invalid` failed: Convex rejects the URL shape and unrelated Admin pages fail without an auth provider. The synthetic `.convex.cloud` hostname was not queried or used as a real backend. |
| `pnpm --filter @school/convex exec vitest run functions/sites/browser-bridge.test.ts` | 1 file, 1 passed in fresh headless Playwright Chromium. Vite reported a non-failing WebSocket port-in-use warning; the fixture HTTP listener used 127.0.0.1 and an ephemeral port. |
| `pnpm --filter @school/convex exec vitest run functions/sites` | 9 files, 25 passed, including the browser test and local TLS probe cases. |
| `pnpm --filter @school/convex typecheck`; `pnpm --filter @school/platform typecheck` | Both passed after adding the browser test. |
| `pnpm --filter @school/convex exec eslint functions/sites/browser-bridge.test.ts`; `pnpm --filter @school/platform exec eslint 'app/schools/[schoolId]/site/page.tsx'` | Both passed without output. |
| `node scripts/audit-theme-colors.mjs`; `git diff --check` | Audit ran, no touched Sites or site settings files flagged. The site Admin controls use product-neutral slate and semantic red error; platform correction uses product-neutral slate, not tenant branding. Diff whitespace check passed. |

Production-output scan: `rg -l 'SITES_GATEWAY_SECRET|SITES_VERCEL_API_TOKEN|CONVEX_SITE_URL|synthetic-private-server-gateway-123456789' apps/{sites,admin,platform}/.next/static` found zero in Sites and Platform and one pre-existing Admin library client chunk containing **`NEXT_PUBLIC_CONVEX_SITE_URL`**, not the private server value. The Sites static bundle has zero OBHIS matches. The Platform site-operations chunk has one OBHIS warning label, not content or an image fixture.

## Limits and approvals still needed

The fresh browser test lives in `packages/convex/functions/sites/browser-bridge.test.ts`, with its browser entry under `e2e/fixtures/sites/`. It mounts the actual Admin site settings and Platform site operations pages through test-only React/Next hook aliases. A localhost fixture RPC dispatches named calls to actual convex-test functions using server-selected publisher, independent reviewer and operator identities with distinct grants. Chromium provisions the synthetic renderer, saves named fields, previews the private draft, confirms publication is blocked before approval and for the reviewer, approves the exact server digest independently, publishes, requests a domain, supplies a mocked authoritative TXT answer, invokes the real readiness action which commits observations after mocked Vercel/DNS/TLS results, activates, and renders the actual public DTO through `admitSite` and `renderSite`. The test then checks public output stays unchanged after a new private draft and becomes unavailable after suspension. It asserts the public DTO and visible output exclude private source references, proof names, auth identifiers, rights/storage fields and the gateway secret. The ranked CNAME and IPv4 display assertion catches the former `[object Object]` operator instructions bug. No provider writes or real image upload occurred.

This is an in-process synthetic integration test, not a deployed Convex, Next or Vercel runtime check. External provider/DNS/TLS observations are mocked; separate local TLS fixture tests cover the real probe's certificate behavior. It does not prove deployed Convex Node trust, live Vercel ingress restrictions, production project assignment or live DNS. Do not call this runtime-ready.

Before a live check, obtain the independently approved school sources, DNS owner, real production Vercel project and credential owner, deployment-owned custom-host list and gateway secrets, provider write approval, actual ingress/routing validation, a reviewed recovery policy for a provider operation with no positive read-only confirmation, and OBHIS adapter/rights review after safe branch transfer. Do not promote this test setup into production configuration.
