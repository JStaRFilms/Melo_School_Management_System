# Production school-site core readiness

Local verification completed on 2026-09-30 in `/Users/toji/Documents/johnsax/sites-production-core`, branch `feature/sites-production-core`. No other worktree was edited. No real pupil data, private OBHIS image, live provider operation, DNS change, remote seed/migration or production deployment was used.

## Implementation

- Pure shared exact renderer/schema and semantic-field manifests, immutable publications, optimistic drafts, independent digest-bound approval, authenticated preview and revert-by-clone.
- Website-only server byte upload with bounded PNG/JPEG decoding and clean PNG re-encoding. Current rights, explicit child classification, exact child-consent pointer, expiry and revocation gates. Public byte delivery has no storage ID or upstream URL projection.
- Hostname reservation, rotating school TXT proof, read-only pending-state Vercel verification/routing instructions, real server checks, controlled SNI/TLS/deployment-marker probe, operator activation, canonical/alias enforcement, maintenance, suspension and retirement.
- Explicit provider-write confirmation, fresh school proof, disabled-by-default live-write flag, durable reservation and uncertain reconciliation. Writes invalidate all readiness, including checks started before the write. Success alone cannot restore serving.
- Server-only published loader/gateway and exact custom-host ingress list, immutable readonly renderer context, code-owned synthetic renderer, explicit development-only legacy demo adapter, canonical application links, noindex unavailable/preview states and publication-aware SEO.
- Scoped Admin typed content/approval/image/domain workflow and separate Platform profile/domain operations. Revert-only and domain-only users receive limited projections, not private drafts or pending asset information.

## Parent-reproduced checks

| Check | Result |
| --- | --- |
| Convex Sites, schema coverage and foundation focused tests | 14 files, 43 passed |
| Sites core tests | 4 files, 11 passed |
| Shared manifest and canonical admissions link tests | 2 files, 8 passed |
| Admin site management/upload tests | 2 files, 7 passed |
| Apply compatibility tests for inherited base changes | 2 files, 23 passed |
| Total targeted tests | 92 passed |
| Typechecks | Shared, Convex, Sites, Admin, Platform and Apply passed |
| Lint | Sites, Admin, Platform, Apply and touched Convex code passed with no errors. Full Convex lint separately reports two existing academic `.mts` parser failures outside this change |
| Production builds | Sites, Platform, Apply passed without backend configuration. Admin passed with synthetic `NEXT_PUBLIC_CONVEX_URL=https://sites-test.convex.cloud` for compile/prerender only |
| Theme audit and whitespace | Audit completed; touched colours classified as product neutral or semantic error. `git diff --check` passed |
| Sites static output scan | No OBHIS/private review fixture or gateway/provider-secret names found |

The fresh headless Chromium test mounts actual Admin/Platform components using test-only session/hook adapters and executes actual authenticated convex-test functions. It demonstrates provisioning, private drafting/preview, independent approval, publication, domain request, read-only pending DNS instructions, actual readiness action with mocked external checks, activation, published rendering, draft immutability and suspension denial. Separate local TLS fixtures exercise the real handshake, trust/hostname/expiry, marker and total-timeout code. No test claims actual provider or deployed backend readiness.

Lint warnings remain informational: one intentional uncached first-party image warning in Sites, 89 existing Admin warnings and six existing Platform warnings. The browser harness reports a non-failing Vite WebSocket port warning. Neither warning was hidden or addressed through unrelated cleanup.

## Reviews

Two independent focused review lanes covered backend security and frontend/management boundaries. Confirmed findings were corrected with regressions. Parent staged-diff inspection also corrected the hardcoded synthetic route seam; renderer page paths now resolve through the exact published manifest without editing core per school, and development demo Host aliases work with ports. Final review found three further security defects, now fixed and parent-retested: cleared child-consent pointer reuse, stale readiness after provider writes, and private data in a revert-only projection. No optional follow-up issues or unrelated cleanup were created. Codex reviewed implementation commit `393eb83e` in PR #101 and identified repeat publication from the same draft version. The correction atomically consumes that version, returns the next editor version and has retry/concurrent-client/UI regressions. Parent reran the affected tests. Thread reply/resolution and final GitHub application checks have separate head-specific dispositions in the PR report.

## Readiness distinctions

- Code-ready: local focused tests, typechecks and relevant builds pass. Admin build needs a syntactically valid public Convex URL, not an actual remote test backend.
- Review-ready: local confirmed blockers and the requested Codex finding are corrected. Codex inspected `393eb83e`, not a later correction or preview-only commit; thread disposition records the fix and its regression tests, not a fresh Codex approval.
- Preview-ready: not established locally. Requires final application build checks on the settled PR head, not the Vercel comment integration alone.
- Runtime-ready: not established for deployed applications. In-process synthetic integration passes; real configured Convex/Vercel ingress, egress, TLS and coordinated app behavior still need authorized testing.
- Release-ready: not established. Backend-first rollout, deployment/cutover authorization and real school approvals are outstanding.

## External prerequisites and limits

1. Provide the real Vercel production project/team, private credential owner, exact custom-host list, configured Convex URLs and gateway secret through approved secret stores. No secrets belong in chat or this document.
2. Authorize any real Vercel attachment/verification, DNS work, backend deployment/migration and frontend deployment separately. No such authorization was inferred from the PR request.
3. Confirm operator and school DNS owner, 30-day TXT renewal procedure, the five-minute maintenance capacity of 20 due hosts and provider-list bound of 100 domains. Excess/expired states fail closed. Recovery of an uncertain provider write with no positive read-only proof needs explicit operator investigation, not blind retry.
4. Transfer `feature/obhis-website` code and the requested review documents safely. Do not transfer secrets/private image bytes merely to enable review. OBHIS's actual schema version, route/field IDs and prop adapter cannot be certified before that inspection.
5. Real school facts, policy/contact approval, photo rights and child consent, the inherited OBHIS hero-contrast issue and actual domain cutover remain separate approvals. This core does not publish OBHIS.

## Merge plan

The owned branch started at the user-requested local master `d21e7664`; the user approved merging `origin/master` into it, completed at `dd88f551` without resetting or rebasing any branch. The resulting PR also preserves the two local-master admissions commits `130c0be6` and `d21e7664`, including their Apply presentation and mockup changes. They are inherited base work, not changes authored by this implementation. Apply compatibility tests, typecheck, lint and build passed. Disclose this inherited history in the PR rather than silently rewriting it.

After review and explicit merge authorization, use Create a merge commit, not rebase or squash. Integrate this core into the OBHIS branch with an authorized merge commit, preserving its design. Register its exact shared manifest in `packages/shared/src/site-manifests.ts`, its matching compiled component in `apps/sites/core/registry.tsx`, and typed props from `ProductionSiteContext` in `apps/sites/core/public.ts`. Core alone loads persistence/tenants and resolves admissions. Replace private fixture identity/copy/assets with approved published fields and first-party asset URLs; never cast to `PrivateReviewContext`. Keep the development review route private and production-disabled. Rerun combined field/route/SEO/link/asset/output and visual accessibility checks before school launch.

Backend schema/functions must deploy and register before frontends use the new functions. Default-branch frontend auto-deployment must be sequenced or paused by authorized operators. Merge authorization does not itself authorize deployment, migrations or DNS cutover.
