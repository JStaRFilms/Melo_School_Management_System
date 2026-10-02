# PR101 merge-ready review corrections

Current reviewed head: `73f86ef9`. Production backend source `989651ab` is already deployed and registered on the explicitly confirmed `prod:outgoing-warbler-782`. Owner authorized backend-first deployment and merge; merge remains pending these confirmed findings and final checks. Work only in `/Users/toji/Documents/johnsax/sites-production-core`.

## Objective

Correct three verified defects from automatic Codex/Kilo reviews before merge. Five unresolved threads represent those three root causes. Preserve authorization, SSRF defenses, publication boundary and compatibility with the previously deployed upload interface.

## Source findings

- IPv6: Codex `4162485005`, thread `PRRT_kwDORvwFBc6oNpOn`; Kilo duplicate `4162799336`, thread `PRRT_kwDORvwFBc6oOZkF`.
- Unsafe alias query continues to HTML routing: Codex `4162485011`, thread `PRRT_kwDORvwFBc6oNpOs`; Kilo duplicate `4162799341`, thread `PRRT_kwDORvwFBc6oOZkK`.
- Unicode upload metadata cannot be represented in raw browser headers: Codex `4162800709`, thread `PRRT_kwDORvwFBc6oOZyc`.

All findings were checked against current code. Do not request further criticism, implement bot-suggested unrelated cleanup or blindly apply suggested code. In particular Kilo's replacement IPv6 regex still excludes 3xxx and is not an adequate reserved-range policy.

## Scope and completion criteria

1. `functions/sites/providerNode.ts`: accept valid public IPv6 global unicast addresses in `2000::/3`, including 2001 and valid 3xxx, using robust parsing/range checks rather than a narrow string prefix. Continue denying unspecified/loopback/ULA/link-local/multicast/mapped-private/transition and documentation/benchmark/special-purpose addresses as appropriate. Preserve IPv4 protections. Use a reviewed public/special-purpose range classification; do not weaken SSRF safety just to satisfy a sample. Normalize address representations for socket pin comparison if needed. Test compressed/expanded/mixed-case public IPv6 and reserved/private counterexamples; keep DNS rebinding and TLS checks.
2. `apps/sites/proxy.ts`: invalid path/query must terminate with a generic 400 or equivalent non-indexable no-store denial, not `NextResponse.next` that allows page HTML on an alias. If an admitted redirect alias cannot produce a canonical redirect, deny instead of falling through. Keep valid known paths and queries intact in 308 redirects and preserve `/apply` behavior. Add actual proxy-level regression coverage with a mocked admitted alias and invalid query.
3. Browser upload, Admin proxy and Convex HTTP upload: transport filename/alt text through an explicit bounded ASCII-safe encoding or body metadata protocol. Prefer narrowly encoded metadata headers with unambiguous names/versioning, safe single decode and strict lengths. Preserve raw binary image processing and auth/capability checks. Support old ASCII/raw clients for rolling deployment; do not blindly percent-decode legacy text such as `100%.png`. Deny malformed/conflicting encoded metadata and controls before storage. Test Arabic/Chinese/Yoruba or equivalent Unicode filename and alt text end-to-end through the actual HTTP handler, plus old clients, percent literal, oversized/invalid encoding and auth denial. No real pupil images.

## Boundaries

Read applicable AGENTS and Convex guidelines before editing. Keep approved school-site design unchanged. Root/per-app `.env.local` files were just copied by explicit owner request, git-ignored and mode 0600. They point to development. Do not read, print, copy, stage or use them to select a live backend. Tests must explicitly use synthetic/in-process fixtures and mocked providers; unset real backend environment variables for any build/fixture that might otherwise connect. No real backend calls, deployment, seed, provider/DNS mutation, commits or push by this subagent. Parent owns deploying the corrected backend before merging frontend changes.

## Artifacts and verification

Expected code changes are limited to provider/proxy/upload metadata paths and necessary pure helper exports and tests. Add no framework upgrades or speculative provider abstractions. Record exact changed files, decisions and passing commands in `docs/tasks/sites-production-core-merge-ready-fix-results.md`. Run focused regression suites, offline equivalent bundle preflight, fresh headless synthetic integration, applicable typecheck/lint and theme audit. Report failures rather than suppressing them. No optional tracking issues or backlog entries.
