# Optimization-only master backport

## Scope

The original review used local master `94ef195` as its base. A release preflight found remote master was still `d2ba632a09776e43684a99b4739885974790e094`. The extra local commit contained 78 unrelated Sites, schema and launch-asset files. The owner selected an optimization-only PR and a merge/deployment hold, and subsequently reiterated that main landing-page work must stay out.

Clean release branch `perf/convex-egress-master` starts from that remote master, not from `94ef195`. It cherry-picks only:

- `a2fd2f0` as `aaebc4f`, the query/read optimizations and their tests/evidence.
- `c030476` as `9ed916f`, the local review records.

The original `perf/convex-egress-evidence` branch and local master remain intact. No rebase, force push or unrelated commit inclusion was used.

The runtime-code changes in this PR remain the compact class-options API and four Admin consumers, conditional archive history reads, and transaction-local reuse of approved assets in Convex Sites resolvers. There are no main landing-page/public-site frontend changes, renderer changes, launch assets, schema/index changes, shared-manifest changes or domain-maintenance cadence changes. In particular, `apps/www`, `apps/sites`, `public`, `deliverables`, `packages/convex/schema.ts` and `packages/shared/src/site-manifests.ts` have no diff against remote master.

## Compatibility adjustment

The original Sites optimization test fixture depended on optional favicon registration, persistent domain-proof markers and indefinite approval fields from the excluded commit. The production optimization itself did not depend on those additions.

Only our new test fixture was adjusted to use the existing master contract: dated approvals/rights, a dated domain proof, one hero asset and two social-share assets. Its assertions for identical responses, fewer read occurrences, child consent, revocation, expiry, tenant ownership, kind and fifteen-minute freshness are unchanged. No production contract or schema was added to make the test pass.

The original evidence report and independent reviewer ledger remain historical records of the earlier base, not a claim that the original broader-base checks were rerun unchanged on this backport. This document records the backport's actual checks.

## Checks on the master backport

Passed:

- Backend typecheck.
- Admin typecheck.
- Thirteen focused backend files, 58 tests, using `--testTimeout 20000`.
- Four Admin files, 25 tests.
- Admin production build.
- ESLint on the adjusted Sites optimization test.
- Informational tenant-color audit against `origin/master`. Existing amber warning and emerald readiness colors remain semantic, unchanged.
- `git diff --check` and explicit excluded-path diff inspection.

The first backend run had 57 passes and one existing Olive publication test exceed its default five-second limit. No assertion or test-file timeout was changed; rerunning with a twenty-second CLI budget passed all 58 tests. A thirty-second lint command also timed out; the longer-budget rerun passed. These first attempts are not reported as passes.

Representative backport measurements retain class response bytes 6,367 to 1,303 and document-read occurrences 703 to 31. The compatible three-asset Sites fixture returns 1,338 response bytes unchanged, with legacy-equivalent page read occurrences 38 to 23 and requested-asset occurrences 27 to 22. They remain synthetic returned-document/JSON proxies, not production billing or measured production savings.

## Release hold

This PR is prepared as a draft under the owner's optimization-only selection. It is not merged or deployed as part of preparing the backport.

Convex deployment replaces an application bundle; it is not an isolated upload of one changed function. Remote master's Sites schema and approval/domain behavior are older than the separately maintained local release baseline. Before any Production push, establish the actual deployed source/schema and prepare a deployment whose effective delta contains only the reviewed optimizations, preserving existing deployed Sites behavior. Do not deploy the older master snapshot over newer production features merely because this PR has a narrow Git diff.

Before merging to master, also check automatic frontend deployment effects against the actual production baseline. The new `listClassOptions` function must be registered on exact Production `outgoing-warbler-782` before the updated Admin frontend is released. Do not change main-site frontend deployment settings or trigger a rollback of unrelated live pages to force this through.

There is no production savings claim, final Vercel preview pass or live/browser acceptance for this backport. The owner's later conditional permission to include safe prior work was not used because the narrow PR was feasible, and it did not override the exclusion of main landing-page work.
