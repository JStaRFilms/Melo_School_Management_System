# OBHIS code-only handoff

## What this branch contains

`feature/obhis-website-code` is a clean source export for the public Melo repository. Its first snapshot copies the verified local renderer, private gate, exact-key asset handler, tests, prototype source and documentation from local checkpoint `2656065`. It starts from the existing public `origin/master`, not from the private-review commit history.

All 55 image entries from the local feature changes were omitted. There are no new photos, generated image files, screenshots, GIFs or SVG image files in the export. Untracked Blender work and uncommitted design refinements were not included. This does not remove any files already present in the public master branch.

The full image-bearing `feature/obhis-website` branch remains local. Do not push or merge that original history into the public repository while the photo permissions remain pending. Removing images in a later commit does not remove earlier image blobs from history.

## Refined renderer snapshot

The next source export copies the verified composition refinements from local checkpoint `09a8663`. It includes the slimmer header, full-width chapters, clearer welcome copy, arrow/counter navigation, mouse/touch gestures, manual hero photo selection and reduced-motion-safe scroll drift. All 19 headless checks passed in the full local worktree, plus a final seven-width responsive recheck, typecheck, focused lint and informational theme audits.

`welcome-motion.ts` is a new renderer-local module. The private context and server gate have not changed. The current Olive headline uses ink on coral at 4.90:1, replacing the original 2.96:1 white/coral headline. This is a specific contrast correction, not full accessibility or publication approval.

Nine additional private capture images are omitted from this update, for 64 omitted image entries across both exports. The text-only verification receipt lists capture names but contains no image bytes. Original approved prototypes remain unchanged. The public branch still has no private review ancestry.

## First automatic welcome snapshot

The preceding source export copies local checkpoint `e72b2f4`. It replaces the earlier manual-only hero with the user-requested three-second Olive/You cycle. "Meet" and "A place for" now pair with the material lettering rather than repeating it. Captions and the duplicate white-scene photo are removed. Each return to Olive advances one of five existing curated photographs. Body-section work remains paused.

The new `welcome-cycle.ts` owns the timer, pause/resume, offscreen/visibility suspension and reduced-motion opt-out. Automatic changes leave focus, history and live announcements alone. All 21 headless checks passed in the full local worktree, plus typecheck, focused zero-warning lint, theme audit, whitespace and the existing production-artifact/source-preservation scan. No fresh production build or real-device audit accompanies this UI update.

All eight new private capture images are omitted. The three exports omit 72 image entries in total. The text-only receipt contains measurements and capture filenames, not image bytes. Private gates, source media and original prototypes remain unchanged. The full local image-bearing branch must still never be pushed to this public repository.

## Supplied composition and six-second cycle

This composition snapshot is local checkpoint `e3bb001`. It matches the user's edited composition, with larger headings, the overlapping Olive print, the You prefix above the lettering, and controls at the bottom-right. The final "e" has extra glyph clearance. The visitor now gets six seconds before each automatic transition. Body sections and the private gate remain unchanged.

The stable `hero-cutout` asset key now reads the separate `hero-composed.webp` derivative. The private preparation recipe and provenance explain removal of the paper fan and shortening of the plain foreground. The original artwork and all school photographs remain intact. The derivative itself is absent from this public branch; include it only in a separately authorized local asset package. OpenCV, NumPy and Pillow are preparation tools, not new product dependencies.

All 22 headless checks, typecheck, focused zero-warning lint, theme audit, whitespace and the existing production/source-preservation scan passed in the full local worktree. No fresh production build or real-device audit was run. The derivative and ten new screenshots are omitted, bringing the total to 83 omitted image entries. Only source, provenance and text measurements are shared here.

## Larger photograph and source edges

The latest source snapshot is local checkpoint `35d7233`. The hero print is larger, using 37 percent of the desktop artboard and 74 percent on phones. Both cyan-surface boundaries circled by the user already reach the supplied source image's frame, so artwork and its preparation recipe were left unchanged. Six-second playback and the rest of the homepage are unchanged.

All 22 browser checks passed across the initial 15 successful checks and a focused seven-check run after a runner timeout. Typecheck, focused lint, theme audit, whitespace and the existing production/source-preservation scan passed. Four new private captures are omitted, bringing the total to 87 omitted image entries. The receipt includes source-edge measurements but no image bytes. No production build, release or photo approval accompanies this update.

## Wide-screen print position

The latest source snapshot is local checkpoint `e55596a`. The enlarged print now uses spare space outside the bounded artboard on wide screens, keeping the final Olive letter readable. Its size, angle and crop are unchanged. Narrow and mobile widths remain inside the stage. The six-second cycle, artwork and body sections are unchanged.

All 23 browser checks passed, plus typecheck, focused zero-warning lint, theme audit, whitespace and the existing production/source-preservation scan. Five new private captures are omitted, bringing the total to 92 omitted image entries. The text receipt records geometry and contains no image bytes. No production build, release or photo approval accompanies this update.

## Homepage story refinement

The latest local source checkpoint is `f2fa08c`. The existing renderer now uses the supplied compact introduction and school-life copy, caption-level photo links, values explanations, simpler campus cards, admissions disclosures and a compact footer. The Olive photo is again a smaller tilted postcard; the second slide retains a separate text-and-art composition. The bundled artwork cannot be rearranged object by object and was not regenerated. Six-second cycling, private gates and original assets are unchanged.

The requested campus exploration links cannot be added yet. Abuja and Rugam are photo-album labels with no verified current campus records or campus-information destinations. The requested Contact admissions CTA also has no approved route: historical contacts are blocked, the demo `/contact` is another school and Facebook is not a verified admissions channel. This export omits those misleading actions. The disclosure answers say only that current visit and application information is unavailable here. Approved campus details, links and a working admissions contact route must be provided before those CTAs can be enabled. User-supplied story copy still needs school approval before public release.

All 24 enabled browser checks passed in the full local worktree, including desktop and mobile layouts, both scenes, gallery tabs/viewer, hero controls, navigation, native disclosures and available CTA targets. Typecheck, focused lint, theme audit, whitespace and the existing production-artifact scan passed. Eight new private screenshots are omitted, bringing the cumulative count to 100 omitted image entries. The text receipt contains filenames and geometry only. There was no fresh production build or deployment.

## Larger section typography

The latest local source checkpoint is `7d5cc34`. The school-life heading and paragraph, values heading/introduction/explanations, section labels and photo captions are larger in proportion to their images. The school-life heading remains two lines at 1047 pixels; values explanations form one column at narrow phone widths. This is a CSS hierarchy change with one focused regression test. No copy, photos, bundled artwork, routes or six-second hero behaviour changed.

All 25 enabled browser checks passed in the full local worktree, plus typecheck, focused lint, theme audit, whitespace and the existing production/source-preservation scan. Twelve new private section captures are omitted, bringing the cumulative omitted image-entry count to 112. The text receipt contains only measurements and filenames. No fresh production build, real-device audit or public deployment was performed. Campus and admissions destinations still need verification before their actions can be added.

## For the production-core agent

Fetch `origin/feature/obhis-website-code` and inspect this branch read-only while implementing production infrastructure on your separate branch. Use paths relative to your checkout. The absolute Windows paths in the earlier task prompt refer to the original development computer.

The current integration points are:
- `apps/sites/core/private-review.ts`, the typed private fixture contract and development-only gate.
- `apps/sites/core/renderer-registry.ts`, exact local renderer matching.
- `apps/sites/renderers/obhis-v1/`, React composition and lifecycle-owned interactions.
- `apps/sites/app/review/obhis/`, the gated developer page and asset endpoint.
- `docs/features/OBHISLocalHomepageReview.md`, scope and local verification history.

This is a private local renderer, not a production published-content adapter. Keep production context separate from `PrivateReviewContext`. Do not activate the developer page publicly, import its fixture as approved content or migrate the fabricated legacy `obhisSchool` record into authoritative data.

## Assets and checks

The guarded endpoint still refers to private review files in the original docs directories. Those image files are intentionally absent here. The visual preview and tests that read those images need a separately authorized local asset package. Do not fetch pupil photographs, put substitutes in `public`, or loosen the development/production gate to make those tests pass.

The recorded browser/build verification was performed in the full local worktree, with the private assets available. It is not a claim that the image-dependent suite passes in this stripped export. Report missing-asset checks honestly as not run until the required local fixtures are supplied.

School facts, photographer rights, child-publication permissions and public deployment remain separate approvals. No DNS change, deployment or public school-site activation accompanies this source push.
