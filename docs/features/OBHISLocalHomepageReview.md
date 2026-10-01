# OBHIS local homepage review

## Goal and scope

Bring the Olive homepage into the existing `apps/sites` Next.js app without publishing it. The initial port preserved the approved composition and manual Olive/You transition. The user subsequently requested composition, copy and interaction refinements, recorded below. The original approved prototypes remain unchanged.

This is a bounded implementation toward ADR-009, not completion of B4 or public B5 activation. Persistent published loaders, authenticated school previews, domain activation, admin editors and deployment are not included.

## Client components

A code-owned `obhis-v1` renderer displays the approved homepage. Its interactions retain native disclosures, manual welcome and album selection, URL/history behavior, keyboard controls, reduced motion, modal focus restoration and no-JavaScript content. Event listeners, animation frames and modal state must clean up on unmount and React Strict Mode remount.

Styles stay scoped to the renderer. Tenant configuration accepts only `primaryColor` and `accentColor`; school UI tokens come from `@school/shared/theme`. Fixed illustration colours from the approved private art study are code-owned, not additional tenant settings or a public theme contract. Branded controls use the shared contrast tokens. The original white-on-coral display-text finding remains recorded for the archived prototypes. The refined renderer replaces that headline with ink on coral, measured at 4.90:1. This specific correction is not a full accessibility approval.

## Server components and data flow

An app-local, exact renderer-key/schema-version registry and a bounded typed private-review fixture provide a read-only renderer context. Unknown keys or versions fail closed. This context is explicitly private review data, not a published revision or approved asset projection.

`/review/obhis` and its exact-key asset endpoint require development mode plus a server-only opt-in. Start the review server bound to `127.0.0.1`; do not expose it through a LAN interface or tunnel. This developer gate is not an authenticated school preview system. Neither a localhost Host header nor noindex provides access control.

```text
Development mode + explicit local opt-in
  -> typed private fixture and exact renderer lookup
  -> scoped obhis-v1 homepage
  -> guarded exact-key asset endpoint
  -> existing metadata-free review assets
```

Production denies the page and asset requests even when the opt-in is set, before reading fixture files. Responses are non-indexable and private assets are no-store. Asset requests cannot supply file paths. Photographs stay in their existing review directories, never in `public`, client imports, Next image optimization or production file traces.

The renderer does not resolve hosts, query Convex, choose publication state or build admissions URLs. No OBHIS application destination is configured, so the existing preparatory guidance stays visible. Future application links must come from the existing canonical `ApplicationLinkV1` resolver, not invented renderer URLs. Existing generic routes, host resolution and SEO remain unchanged.

## Database schema

No schema or backend changes. Existing B0 site records do not authorize this private fixture for public use.

## Approval and verification

Visual approval does not approve facts or photographs for publication. Abuja and Rugam remain album labels. Photographer rights, child-publication permissions, current operational facts, canonical application/visit destinations and real-device review remain open. See `../clients/obhis/OBHISContentApprovalSheet.md`.

Focused checks cover development opt-in denial, production denial, exact asset keys and traversal, no private image bytes in production output/traces, unchanged legacy behavior, six viewport widths, both heroes, stable content positions, keyboard/history, modal focus, reduced motion and no-JavaScript content. Use an isolated sites-only headless runner, not the multi-app default test setup. Run sites typecheck, focused lint and the informational theme audit.

Status: local review slice implemented and checked. This is not B4 completion, public activation or production accessibility approval.

## Local setup

Run these commands from `_w/obhis-website`, not the main checkout. The worktree uses the existing locked dependencies. This run installed them locally with no downloads, manifest/lockfile changes or lifecycle scripts:

```sh
pnpm install --offline --frozen-lockfile --ignore-scripts --filter @school/sites... --filter school-management-system
pnpm exec cross-env OBHIS_LOCAL_REVIEW=1 pnpm --filter @school/sites exec next dev --webpack --hostname 127.0.0.1 --port 3215
```

Open `http://127.0.0.1:3215/review/obhis`. The server-only `OBHIS_LOCAL_REVIEW=1` opt-in is exact. Missing opt-in, any other value and production mode deny access. Do not bind this server to a LAN interface or tunnel it. Stop only your own review server before running the checks below; the isolated runner refuses an occupied target and does not reuse existing servers.

## Implemented boundary

- `apps/sites/core/private-review.ts` defines and validates the frozen private context. `obhis-review-fixture.ts` contains the two theme inputs, pending publication rights and a null application link. It is not a persisted revision or approved public asset projection.
- `apps/sites/core/renderer-registry.ts` matches only `obhis-v1` with schema version `1`. Unknown keys and versions return no renderer.
- `apps/sites/app/review/obhis/page.tsx` checks the development gate before loading the fixture/registry. Denied metadata omits the review school name. Production compilation removes the development import branch.
- The asset route and `core/private-review-assets.ts` both gate access before reads. Nine exact keys map to existing docs fixtures. Successful and denied asset responses are `private, no-store` and non-indexable. No user-supplied paths, public copies, image imports or optimizer URLs were added. The page is dynamic and non-indexable; Next dev supplies its own `no-cache, must-revalidate` page header.
- `renderers/obhis-v1` retains the system fonts, intact artwork and finite manual transition. User-requested composition changes are recorded below. The effect owns scoped listeners, global history/page-lifecycle listeners, readiness and scroll frames, pointer capture and native viewer cleanup. Tailwind heading/list resets are restored locally. The inactive server-rendered hero is hidden; enhancement applies inert/ARIA states to both motion poses. All four album photos remain available without JavaScript.
- No host resolution, catch-all, proxy, SEO, shared contract, backend, schema, admissions logic, other app or dependency configuration changed. The pre-existing edited `obhis-homepage-review.md` and untracked Blender work were left untouched.

## Theme audit classification

The explicit-file informational audit reports `#176c49` and `#39bcd3` in the private fixture. They are the only tenant inputs, primary and accent. Actual school tokens come from `deriveSchoolTheme`. Green-filled controls use `--school-primary-contrast`; the cyan chapter uses `--school-accent-contrast`. Its white photo sheets retain neutral ink.

The audit does not scan CSS, so the scoped stylesheet was classified separately. Coral `#ef704d`, its highlight/shadow variants `#da5737` and `#bc5138`, and pattern pink `#e7a5b0` are code-owned colours from this private artwork study. They are not configurable tenant roles. Ink `#142c38`, white, warm paper `#fffdf8`, line `#dbe3e6`, muted ink `#45606a`, footer text `#ccd9df` and the ink modal backdrop are product neutrals. No status, grade-policy or print colours changed. The archived white-on-coral headline remains 2.96:1. The current renderer no longer uses it. Current ink/coral headline and supporting copy measure 4.90:1. Dark coral You display text on white measures 3.89:1, above the large-text threshold. Full accessibility and publication review remain required.

## Initial port checks

During the coder's initial verification, all test servers were owned by that run, bound to `127.0.0.1` and stopped by the isolated runner. No personal browser profile, desktop control, credentials, backend scripts, deployment, push or commit was used in that initial verification.

| Command | Result |
| --- | --- |
| Locked offline install shown above | Passed, 525 packages reused from the existing store, zero downloads, scripts ignored. |
| `pnpm --filter @school/sites typecheck` | Passed after fixing two port typing errors and the test's readonly environment assignment. |
| `pnpm exec eslint apps/sites/core apps/sites/app/review apps/sites/renderers/obhis-v1 apps/sites/e2e --max-warnings=0` | Passed with zero warnings. An initial invocation exceeded its 90-second limit; a subsequent run found four JSX apostrophes, which were escaped before the passing rerun. |
| `pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts` | Passed, 15 tests. Six widths, both heroes, zero horizontal overflow and unchanged downstream positions for hero/album selection; keyboard, history/reload, rapid reversal, focus settlement, viewer controls/Tab/Escape/restoration, modified-click non-interception, visit reopening, reduced motion, no-JS photos/guidance, exact keys, registry/fixture and legacy behavior. |
| `pnpm exec cross-env OBHIS_TEST_MODE=denied pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts` | Passed, 3 tests. Development opt-out denies the page and all nine assets; unknown/traversal paths deny, and legacy behavior remains separate. |
| `pnpm exec cross-env OBHIS_LOCAL_REVIEW=1 pnpm --filter @school/sites exec next build --webpack` | Passed, including Next's TypeScript check. |
| `pnpm exec cross-env OBHIS_TEST_MODE=production pnpm exec playwright test --config=apps/sites/e2e/playwright.config.ts` | Passed, 3 tests. Production denies the page and all nine assets despite opt-in. |
| `node apps/sites/e2e/verify-production.mjs` | Passed. Scanned 127 production output files and 12 traces. No bytes from any of the nine private images, and no docs review assets in traces. Forty protected files unchanged; approved HTML/CSS/JS and review image bytes exactly match HEAD. Existing checkout CRLF is accounted for in other text files. Development output and caches are excluded from this production artifact scan. |
| `node scripts/audit-theme-colors.mjs` and its explicit-file invocation with `apps/sites/core/obhis-review-fixture.ts apps/sites/core/private-review.ts apps/sites/renderers/obhis-v1/Homepage.tsx apps/sites/renderers/obhis-v1/interactions.ts` | Passed, informational. Classification recorded above. |
| `git diff --check` and `git diff --cached --name-only` | Passed; no whitespace errors or staged files. |

The first browser run passed 14 of 15 checks. The failing assertion incorrectly required Next dev's page header to contain `no-store`; the contract requires that header on assets. The assertion now checks Next's actual non-cacheable page header and still requires explicit `no-store` on every asset. The production-source checker initially compared Git LF blobs with existing Windows CRLF checkouts. It now checks those checkout endings without relaxing exact-byte checks for the approved renderer source and review images.

Next reports an inherited workspace-root inference warning because this worktree sits below another workspace. No routing, lockfiles or Next configuration were changed to suppress it. The existing root stylesheet also imports Google fonts; browser tests fulfill that legacy stylesheet request locally and the new renderer uses system fonts. No new external font or script was added.

## Independent parent verification

A normal synchronous GPT-6.1 Sol High reviewer found no confirmed blocking findings in the gates, asset delivery, scoped styles, lifecycle cleanup or approved composition. It also checked production artifacts and protected-source preservation. No review-driven code changes were needed.

The parent independently reran sites typecheck, focused lint, the 15 enabled headless tests, 3 development opt-out tests, 3 production tests, production asset/trace verification, both theme-audit invocations and whitespace checks. All passed. The artifact scan covered 127 production files and 12 traces, excluded all nine private images and confirmed 40 protected files unchanged.

Seven new PNGs and `parent-visual-verification.json` are in `deliverables/obhis-local-review/`. Fresh headless Chromium captured both welcomes at 1440, 390 and 320 pixels and the desktop viewer. Touch emulation at 390 and 320 passed welcome selection, cultural album selection, viewer navigation and close. The modal stayed centred, Escape restored opener focus, scrolling unlocked and no page errors occurred. Desktop composition and narrow-screen captures were visually checked against the approved study. Developer chrome was hidden only for capture; source artwork and prototypes were not changed.

The capture helper stopped its shell but left its child server running on Windows. The parent verified the exact owned process chain, stopped only those descendants and confirmed the review port closed. No pre-existing server, desktop process or personal browser was touched. The installed helper was not modified.

## First composition refinements

The user approved a swipeable hero rather than two separate scrolling sections. The renderer now removes the top review strip and capped outer page rails, keeps readable inner gutters, reduces the desktop header to 76 pixels and uses a compact arrow/counter cue instead of Olive/You tabs. Footer, album and viewer permission notices remain. The development gate and non-indexing metadata are unchanged.

The first refined Olive headline was "Welcome to Olive." The disconnected right-hand prose and duplicate campus button are removed. A short introduction and one school-life link sit with the heading. The You message is "A place for you." No school facts, programmes or application destinations were invented.

At this stage, three existing school photographs could be selected manually inside the hero print. There was no autoplay timer. Mouse drag and native horizontal touch select welcomes; normal vertical wheel/touch scrolling and pinch zoom remain native. Scroll input gives the artwork and print a bounded upward drift. Reduced-motion preferences remove that drift, slide travel and photo arrival animation. `welcome-motion.ts` owns the gesture and input-driven scroll behavior; shared abort cleanup releases capture, listeners and frames.

Parent verification passed 19 headless tests, including seven widths from 1920 to 320, stable downstream positions, manual moment cycling, actual Chromium touch injection, mouse drag, vertical scrolling, keyboard/history/focus, viewer behavior, reduced motion, no-JavaScript content, private-route gates and legacy separation. A temporary runner used only the proven owned loopback preview, leaving the user's server running. The normal committed runner still refuses occupied ports.

The first refinement run passed 17 tests and exposed two failures. Touch's implicit image capture bubbled a capture-transfer event, incorrectly cancelling the gesture. The handler now responds only to capture lost by the stage itself. The wide-layout assertion incorrectly included the browser's reserved scrollbar gutter; diagnostics confirmed every chapter fills the drawable body width. The corrected full suite passed.

Sites typecheck and focused lint passed. The first directory-wide lint invocation timed out; the explicit changed-file invocation passed with zero warnings. Desktop welcome and mobile captures are in `deliverables/obhis-composition-refinement/`. They are private local evidence, not public export assets.

## First automatic welcome cycle

The user then requested automatic three-second scene changes and rejected the repeated headline words, photo caption and typography. The hero now pairs "Meet" with the existing Olive lettering and "A place for" with the You lettering. Complete accessible headings remain. Both scenes use the same rounded system-font stack, one shared school-life link and a fixed stage height. The white scene has no duplicate photograph or caption. Each return to Olive advances one of five existing curated photographs. No source media or body sections changed.

`welcome-cycle.ts` owns one three-second timeout. Automatic changes do not write history, move focus or update the live announcement. Manual navigation, keyboard focus in the hero, touch/drag and opening the viewer pause playback until the visitor presses Play. The timer also stops offscreen, in a hidden document and during page suspension. Reduced-motion preference disables automatic playback. Cleanup clears the timer and disconnects the observer alongside the existing listener/frame cleanup. Without JavaScript, the Olive introduction, album photographs and native guidance remain available.

A wide capture exposed horizontal scrolling inside the clipped stage after early focus. The stage now uses `overflow:clip` rather than a hidden scroll container. Responsive checks assert zero internal horizontal scroll. The corrected eight captures show complete settled scenes, no overflow, no running animations while paused and no page errors. They remain private in `deliverables/obhis-welcome-cycle/`.

All 21 headless checks passed, including seven responsive widths, the automatic sequence, photograph rotation, pause/resume, focus/history/announcement stability, offscreen suspension, a simulated document-visibility event, reduced motion, native mouse/touch, viewer behaviour, no-JavaScript content and private gate contracts. Sites typecheck, focused zero-warning lint, whitespace and the informational theme audit passed. Ink and white are product neutrals; fixed illustration/paper-shadow colours remain code-owned. Tenant branding still uses the shared two-input tokens.

The existing production-artifact/source-preservation scan passed. A fresh production build was not rerun for this renderer-only change. The document-visibility event was simulated in an isolated headless page, not tested by controlling a personal browser. Real-device and other-engine checks remain pending.

## Supplied composition and six-second correction

The user supplied an edited two-scene composition and approved the resulting local layout. The renderer now has a larger "Meet" without the repeated school-name eyebrow, a photograph overlapping the Olive artwork, the "A place for" prefix above the You lettering, and scene controls at the bottom-right. A bounded renderer-local artboard keeps these relationships on wide screens while the background bands remain full width. Phones use a separate vertical arrangement, with the link and controls on separate rows. The desktop school-navigation link remains visible at the reference width.

The reference also removes the paper fan. `prepare_composed.py` makes a separate `hero-composed.webp` from the original imagined artwork, cloning existing cyan-surface texture over the fan and shortening only the plain foreground below row 480. The lettering and fabric are not resized. The original `hero-cutout.webp` and all school photographs remain unchanged. `composed-provenance.json` records hashes and the operation. Pillow, NumPy and OpenCV are local preparation tools, not product dependencies. The existing exact `hero-cutout` review key now reads this derivative from the same private directory. No gate, schema or asset-key contract changed.

The user then pointed out clipping on the final "e" in "A place" and requested six seconds before each transition. The clipped headline lines now reserve right-side glyph space without moving the text. The single timer waits 6,000 milliseconds; each return to Olive still changes the photograph. Automatic history, focus, announcement, pause and reduced-motion behaviour is unchanged.

Verification passed 22 headless checks, including composition geometry, overlapping art/photo, footer controls, unobstructed link/control targets, glyph clearance, the six-second delay and the existing responsive/interaction/private contracts. The first six-second test run passed 21 checks and exposed a test-clock setup error. Installing the clock before navigation now captures the first timer rather than relying on an already-running native timer. Sites typecheck, focused zero-warning lint, whitespace and informational theme audit passed. A parallel lint run timed out; the standalone focused rerun passed, with no remaining owned lint process. The existing production scan excludes all ten private image files, including both artwork versions, and preserves the original protected sources. No fresh production build was run while the user's development preview remained active.

Ten private review captures and a text receipt are in `deliverables/obhis-reference-composition/`. They show no overflow, internal horizontal scroll, page errors or running animation while paused. Body-section changes remain paused. Images, publication approval and production infrastructure are still outside the public source export.

## Larger photo and source-edge check

The user requested a larger framed photograph and asked whether the two circled cyan-surface cuts were introduced here. Both already meet the supplied image's frame boundary. In the original cutout, column zero is opaque at rows 641 through 796, and the final row is opaque at columns 1098 through 1334. The prepared artwork retains the same bottom span with the existing one-pixel mask inset. The original RGB image also visibly ends there. No artwork, alpha mask or preparation recipe changed in this update.

The print now uses 37 percent of the desktop artboard instead of 31 percent, and 74 percent on phones instead of 68 percent. Its photograph sequence, crop ratio, six-second timer and the rest of the homepage are unchanged. Four private paused captures and the edge finding are in `deliverables/obhis-photo-size/`.

The full browser run timed out after 15 successful checks during native-touch verification. The seven remaining checks passed in a standalone run, covering touch, viewer, reduced motion, no JavaScript, private routing and legacy separation. The owned worker had exited; no pre-existing process was stopped. Together all 22 checks passed. Typecheck, focused zero-warning lint, informational theme audit, whitespace and the existing production/source-preservation scan also passed. All ten private images and 43 protected files remain unchanged. Captures show no errors, overflow, internal horizontal scroll or paused animation. No new production build or real-device audit was run.

## Public code-only sharing

The repository is public. After being told that the full local history contains pending-permission school photos, the user authorized a code-only public branch. `feature/obhis-website-code` starts from existing public master, excluding the private feature ancestry and all 55 image entries. Its initial verified source snapshot is `9484213`. The image-bearing `feature/obhis-website` branch stays local and must not be pushed to the public remote.

Public source exports include a handoff note explaining that private review image fixtures and image-dependent checks are unavailable there. GitHub source sharing is not a school-site deployment or photo-publication approval.

## Remaining publication review

Real-device performance, other browser engines and full production accessibility auditing remain unrun. Touch emulation is not real-phone certification. These local checks do not approve school facts, photographer rights, child-publication permissions, a canonical application/visit destination or public release.
