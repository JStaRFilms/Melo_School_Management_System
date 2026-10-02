# Olive production integration plan

## Objective

Continue the full `feature/obhis-website` branch with the approved Olive composition and connect its renderer to PR #101's immutable publication contract. Keep local review data and public data separate.

## Checkout and authorization

- Worktree: `/Users/toji/Documents/johnsax/melo-obhis`.
- Verified starting HEAD: `b435670d95ffe8527058254ffc739ffe9a720a4d`.
- PR #101 was checked through GitHub and is merged at `72a985e430451cbd83627a11a158ec7115d3f097`.
- The user explicitly authorized merging that baseline locally in this conversation. Local merge HEAD: `1c183cc887a3c191e57b598f8e624dd166c212f7`.
- The owner approves existing Olive photos, campus details, and public source inclusion of the current address, phone and email. This approval is not a backend evidence record or site activation.
- Missing campus, application and donation destinations remain placeholders. No invented URLs, maps, booking or payment workflow.
- At the initial integration checkpoint, push, PR creation, deployment, DNS writes, public publication and activation were not authorized. The later rollout request authorizes push, PR creation, and backend/frontend deployment. It still does not authorize merge, DNS changes, real-school publication or activation. See `obhis-pr-rollout-plan.md` for the current operating scope.

## Baseline evidence before behavior changes

Locked offline install reused 527 packages, with zero downloads and scripts disabled. Sites typecheck and both informational theme audit invocations passed. All nine mapped review assets are present.

Enabled Chromium tests passed 25 of 27. The phone geometry assertion failed; the synthetic Ctrl-click test navigated away on macOS and then timed out. Investigate both rather than weakening assertions without measurements. Development opt-out passed 3 of 3. A fresh production build, production denial tests 3 of 3 and the artifact scan passed. The scan excluded ten private image files from 125 output files and 12 traces, and verified 43 protected files unchanged.

Next's generated `next-env.d.ts` was restored after baseline testing. Browserslist reported an old data warning; this is not an asset failure.

## Implementation scope

1. Read the merged production contracts and Convex guidelines. Register one exact shared `obhis-v1/1` manifest with stable typed IDs matching the actual homepage. Keep existing synthetic behavior intact.
2. Build a typed projection from validated, frozen `ProductionSiteContext` to Olive view props. No casts to `PrivateReviewContext`, private fixture imports or review asset fallback in production.
3. Reuse the composition and interactions through a presentation-only model. Bind school facts, contacts, campus labels, editorial content and images to approved public fields and first-party asset routes. The local fixture may provide the same presentation model through a separate development adapter.
4. Supply only the primary/accent theme inputs through a validated publication path. Derive all branding with `@school/shared/theme`. Preserve code-owned artwork colours and product neutrals.
5. Retain per-photo rights, child classification, consent, checksum, expiry and revocation checks from the backend. General owner approval must not bypass these records. Existing WebP sources cannot be uploaded directly to the backend's PNG/JPEG-only endpoint; document safe derivative preparation without uploading anything.
6. Update current preview notices and approval documents to distinguish owner approval from pending backend records and launch authorization. Preserve historical review evidence, marking superseded assumptions clearly.
7. Diagnose and fix baseline tests, adapt legacy expectations to the explicitly gated demos introduced by #101, and preserve the private-route gates and production asset scan.

## Completion criteria

- Exact manifest and compiled renderer are registered; unknown versions, missing required fields/assets, malformed contacts/theme and private contexts deny.
- Production renderer uses published approved values and first-party asset URLs only. It never reads local docs or invents external destinations.
- Publication tests exercise Olive identity/sensitive-field evidence and every required photo's current evidence, expiry and revocation.
- Sites/shared/Convex typechecks, focused unit/backend tests, enabled/denied/production browser tests, fresh production build, lint and informational theme audit pass or have explicit unresolved reports.
- Production artifacts exclude private source bytes and traces. The approved artwork, photos and prototypes remain unchanged.
- Independent review checks tenant/publication isolation and real render output, with corrections applied before final handoff.

## Deliverables

Exact shared manifest, presentation model and adapters, registry entry, regression tests, current approval notes, and `docs/tasks/obhis-production-integration-results.md` with commands and remaining runtime/launch dependencies.
