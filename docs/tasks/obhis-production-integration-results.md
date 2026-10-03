# Olive production integration results

The exact `obhis-v1/1` manifest now has one homepage route, required published copy, contacts, two theme inputs and nine first-party assets. The public registry renders only the frozen context admitted by `core/public.ts`. A separate development adapter feeds the same presentation component from the local fixture. The public adapter has no fixture import, docs path, social URL or private asset fallback. An open, validated `ApplicationLinkV1` alone supplies an apply link. Campus details and donation routes remain visible placeholders.

The owner approved the existing Olive photos and campus details, and public source inclusion of Plot 18C3, Habiscus Street, Federal Housing Estate, Karu Roundabout, Nyanya, Abuja, FCT, +234 805 775 5997 and obhischool@gmail.com. This owner-content decision did not create backend evidence or publish a revision. The subsequent rollout request separately authorizes backend/frontend deployment, as recorded in `obhis-pr-rollout-plan.md`, without authorizing merge, DNS changes or school-site activation. The revised approval sheet preserves the older D2 observations while marking the current owner decision. The review page acknowledges that approval and says backend records are unverified here. It does not assert that the owner's permissions remain pending.

## Checks

- Locked offline install with frozen lockfile and scripts disabled for Sites, shared, Convex and root passed. Zero downloads.
- Sites, shared and Convex typechecks passed after install.
- Shared manifest and application-link tests passed, 9 tests. Sites core tests passed, 16 tests, including actual static rendering of a synthetic admitted Olive DTO and changed published values. The full Convex Sites suite passed, 36 tests, including the inherited Admin/Platform Chromium bridge. The new publication test uploads synthetic PNG pixels only into a local `convex-test` database and checks every required asset's rights, child classification, child consent and expiry, plus digest-bound approval of every editorial/contact/theme field and school identity, publication and revocation. No remote backend was called.
- The informational theme audit passed both globally and for touched school-facing TypeScript. The two fixture/test hex values are primary and accent inputs, not extra brand tokens. `#00000000` is a rejected-input test. Scoped CSS still uses fixed artwork coral/pink and product-neutral ink/white/paper colours; no semantic status or grade tokens changed. The global audit also lists untouched admin/teacher/platform colours. Focused zero-warning ESLint passed. Development opt-out browser tests passed 3/3. After correcting the modified-click test, the final enabled browser run passed 27/27. A fresh webpack production build and production opt-in denial browser tests passed 3/3.
- The production scan passed on the fresh build. It checked 137 output files, 14 traces, excluded the unchanged bytes of all ten private images, and verified 40 protected original files. It checks that the only public route source change is the scoped stylesheet import. No original image or prototype was changed.

## Review corrections and independent verification

Independent review identified unapproved SEO strings, unreviewed uploaded alt text and malformed email syntax. The later pre-PR review also adds a contrast-safe values-heading accent and keeps empty QR layout studies in private review only; the public donation notice remains a placeholder. Olive metadata now repeats only the exact independently approved visible `school_name` and `intro` fields. Social images fail closed until their own reviewed image/alt contract exists. Every required image has a separate `<asset_field>_alt` sensitive-public text field, with exact digest evidence. Backend publication and frontend admission compare it to the uploaded alt text. Neither image rights nor owner approval bypasses this review.

Email validation rejects leading, trailing and consecutive dots, literal query syntax and every percent character, including encoded CRLF/header injection and nested encoding. Draft and public tests cover both gates. The immutable-publication regression validates a known-good publication before and after each image's expired consent, missing consent pointer, expired rights evidence and expired classification evidence. Alt changes, revoked alt approval and revoked rights deny independently. It does not rely on an already-consumed draft version. The follow-up reviewer reported no remaining confirmed blockers; this was code review, not a live-backend approval.

The parent independently reran the three typechecks, all 16 Sites core tests, 9 shared tests, 36 Convex Sites tests, zero-warning touched-file lint, theme audit, 27 enabled Chromium tests, 3 development-denied tests, production build, artifact scan and 3 production-denied tests. The initial broad backend run failed because the filtered install omitted Admin/Platform dependencies. A locked offline install reused 49 more packages with zero downloads and scripts disabled; the full rerun passed. Vite still emits a WebSocket port warning in the inherited browser bridge; its HTTP fixture uses an ephemeral loopback port and all bridge assertions pass. No existing listener was stopped. Directory-wide lint reports the inherited intentional synthetic-renderer image-optimizer warning; touched-file lint passes with zero warnings.

The approved values heading retains its two-line cyan treatment while rendering published text only. Original photo/art/prototype bytes remain unchanged.

The unit SSR run emits a React warning for the existing `fetchPriority` attribute under its older React server renderer; the Next build and browser runs pass. Browserslist also reports six-month-old data. Neither warning was suppressed.

The earlier phone failure was measured at 320 by 740: the controls ended at x=300.8 and y=718, the link ended at y=664, but the document scrolled to x=336 because the header navigation ended at x=335.5. The brand's full single-line name displaced the navigation. Allowing the brand to shrink and wrap restored the no-overflow assertion without removing any geometry check. On macOS, a synthetic Ctrl-click navigated to the photo asset. The test now observes both Ctrl and Meta event paths after the renderer's listener, then cancels the browser default on `document`; it checks that the renderer did not prevent the event, did not open the viewer and did not change the current page URL.

## Reproduction commands

Run from the repository root with the existing offline pnpm store. These commands require no provider credentials.

```sh
pnpm install --offline --frozen-lockfile --ignore-scripts --filter @school/sites... --filter @school/shared... --filter @school/convex... --filter school-management-system
pnpm --filter @school/sites typecheck
pnpm --filter @school/shared typecheck
pnpm --filter @school/convex typecheck
pnpm --filter @school/sites exec vitest run core
pnpm --filter @school/shared exec vitest run src/site-manifests.test.ts src/__tests__/admissions-foundation.test.ts
# Also install Admin/Platform dependencies offline to run the inherited bridge.
pnpm install --offline --frozen-lockfile --ignore-scripts --filter @school/admin... --filter @school/platform...
pnpm --filter @school/convex exec vitest run functions/sites
pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts
pnpm exec cross-env OBHIS_TEST_MODE=denied pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts
pnpm exec cross-env OBHIS_LOCAL_REVIEW=1 SITES_ENABLE_LEGACY_DEMOS=enabled pnpm --filter @school/sites exec next build --webpack
node apps/sites/e2e/verify-production.mjs
pnpm exec cross-env OBHIS_TEST_MODE=production pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts
node scripts/audit-theme-colors.mjs
git diff --check
```

A Next build may rewrite `apps/sites/next-env.d.ts`; restore that generated file to its original checkout contents after verification.

## Local state at the integration checkpoint

Worktree: `/Users/toji/Documents/johnsax/melo-obhis`, branch `feature/obhis-website`. The expected starting commit was verified as `b435670d95ffe8527058254ffc739ffe9a720a4d`. PR #101 was already merged on GitHub. The user then authorized importing its exact merge commit locally; HEAD is `1c183cc887a3c191e57b598f8e624dd166c212f7`. Integration edits remain unstaged and uncommitted. Nothing was pushed, no PR was created, and no deployment, DNS/provider write, real-school publication or activation was performed.

The last browser/build run passed 27 enabled, 3 development-denied and 3 production-denied tests. The final artifact scan covered 137 files and 14 traces, excluded ten private images and preserved 40 protected files. Both informational theme audits and whitespace checks passed. All three owned review ports were closed after the runners stopped.

The first background subagent launch was blocked by an async-directory guard before execution. The user instructed foreground agents only; every subsequent implementation/review run was synchronous.

## Remaining dependencies

All provider and host observations remain unavailable here. A real production path needs independently reviewed exact field digests, per-asset rights and child classification, child consent for child photos, current unrevoked evidence, a persisted school name matching the approved `school_name`, an immutable publication, approved host readiness, first-party byte delivery and operational release authorization. The docs WebP files are references only. Prepare separately reviewed, clean PNG or JPEG derivatives from the approved originals, inspect crop and visual fidelity, remove metadata, then submit each derivative to the existing authenticated upload when authorized. The backend transcodes accepted PNG/JPEG to clean PNG and hashes the stored result. Nothing was uploaded in this task. There is no live application, campus detail, visit booking or donation destination to invent. Real-device, other-engine and full accessibility checks are still outstanding.
