# Olive homepage review

## Scope

Open `obhis-homepage-review.html`. This page extends the approved Olive/You welcome into a full private homepage review. The hero markup, artwork and motion controller remain unchanged. The motion-only prototype and approved still studies remain separate.

The page moves from the welcome to an introduction, a school photo album, the crest and uniform, campus photo albums, admissions/visit guidance and a footer. It uses no new generated artwork, Blender scene, backend connection, form, payment flow or production deployment.

The user approved the heroes and their transition. The new sections still need visual review. School facts and photo publication rights remain separate approval decisions.

## Content and photo trace

| Visible item | Evidence | Treatment |
| --- | --- | --- |
| Olive Blessed Crest Academy | Supplied crest/booklet and approved hero | Existing review identity, not a new legal-name approval. |
| Integrity & Service | Supplied school logo | Reproduce the crest wording; no new educational or safeguarding claims. |
| School friends and classroom tables | `2026-07-12_school_visit/RAW/DSC04736.JPG` and `DSC04757.JPG` | Real school-folder photographs, with descriptive captions only. No pupil names or quoted testimonials. |
| Abuja cultural day | `2025-12-02_cultural_day/images/abuja/DSC02665.JPG` | Abuja is the source album label, not confirmation of a current campus listing. |
| Rugam cultural day | `2025-12-02_cultural_day/images/Rugam/DSC03099.JPG` | Rugam is the source album label; spelling and current campus identity need confirmation. |
| Uniform detail | Face-free crop of `2026-07-12_school_visit/RAW/DSC04741.JPG` | Shows the actual pattern behind the approved art direction. Photographer rights still need confirmation. |
| Multiple campuses, shared identity | User's supplied direction | No invented campus addresses, contacts, maps or programme records. |
| Facebook link | User-supplied `https://www.facebook.com/profile.php?id=100010370084416` | Real outbound link. No simulated social feed or claim of verified Facebook posts. |
| Admissions and visits | Parent questions and the existing platform contract | Preparatory questions, not school requirements. Missing application links, intakes, fees and visit arrangements stay labelled where needed. No information is collected. |

Anonymous Facebook access returned only the profile title, Obhischool Olive. Public search did not provide reliable school evidence. Personal-browser research stopped at the user's request. This pass does not depend on desktop control, browser credentials or logged-in Facebook scraping.

Only curated photo directories supplied imagery. Results, fees, staff/payroll records and pupil-ID portraits did not supply website content. Do not publish the photographed enrolment booklet or carry over the fabricated `obhisSchool` demo record.

`obhis-homepage-review-assets/prepare_photos.py` resizes five photographs and strips metadata. The uniform detail has a recorded crop. It does not recolour photographs, alter people or overwrite originals. `provenance.json` records source/output SHA-256 hashes, dimensions and processing. School photographs remain private fixtures until photographer rights and child-publication permissions are confirmed.

## Composition and interaction

The approved welcome opens into a school album, connected by the uniform's real pattern. White paper gives the photographs room. Cyan marks the campus chapter; ink holds the crest and footer. The existing coral hero remains the opening signature. New direct colours are tenant art-direction studies or product neutrals, not status or grade colours.

The album has two manually selected collections. Four print numbers match the four-photo viewer order, not school statistics or admission steps. Opening a photograph shows its full composition in a native modal with previous/next controls and a permission notice. Escape closes it and restores focus. The campus photographs open the same viewer.

The page uses native anchor scrolling and native disclosures. Visit links reopen the visit guide if a visitor has closed it. No carousel, scroll gate, custom cursor, fake camera move or idle animation loop was added. Reduced motion removes the hero travel, album arrival and smooth scrolling. Without JavaScript, all four photos are visible and each photo link opens its image directly.

## Reference manifest and receipts

The following current references were read completely and checked against this continuation:

- `frontend-design/SKILL.md`: structure must encode real information. Album numbers correspond to the viewer index; no fabricated metrics or numbered admission process.
- `creative-web-development/references/motion-and-scroll.md`: input needs a coordinated owner, and split headings need an intact accessible name. The existing hero controller owns the welcome; the album controller owns its selected collection. New headings are plain semantic text. No extra scroll engine or ticker.
- `creative-web-development/references/performance-and-profiling.md`: reduced motion must preserve the experience, and animated resources need a lifecycle. CSS motion is finite; static-page listeners leave with the document. Native modal scrolling locks only while the viewer is open. Headless verification instruments the runtime without adding a permanent diagnostic loop to the page.
- `creative-web-development/references/concept-evaluation.md`: facts need labels at the point of use. Campus album labels are explicitly provisional as campus data. Admissions/visit arrangements and photo publication limits remain visible near their content.

The governing concept scores mostly 3 or 4 on the rubric. Its strongest decisions are the school-derived pattern, actual photography and continuity with the approved hero. A stock-photo gallery and feature-card grid were rejected. The main weakness remains operational utility: confirmed school contacts, programme information and the canonical application link are needed before this can become a public website. Device performance and production accessibility still need real-device review.

## Verification

Run `python docs/mockups/sites/obhis-homepage-review-assets/verify_homepage.py` from the worktree. It needs Pillow, Python Playwright and its installed Chromium browser. It starts a temporary localhost-only server and a fresh headless browser. It never attaches to a personal browser.

- Both welcome states passed at 1440, 1024, 768, 760, 390 and 320 pixels. No horizontal overflow, page errors, failed image requests or external page requests. The shared content shifted 0px when changing the welcome or photo collection.
- Photo selection, touch controls, scoped arrows, Tab and Shift+Tab, Escape, opener-focus restoration, modal sizing, visit-guide reopening and keyboard disclosures passed.
- Native Chromium initially sent Tab focus to BODY between the viewer's last and first controls. A viewer-only boundary guard fixes it. Visual review also caught the height-capped photo frame shrinking to the left; explicit full width keeps the full image centred. Focused regressions and the full check passed after these fixes.
- Welcome URL, reload, history and keyboard checks passed. Directly opening the local HTML file also passed script/style loading, welcome URL changes, album selection and the viewer image. Reduced motion removes travel, album arrival and smooth scrolling. The no-JavaScript page shows all four photos and direct image links.
- A finite runtime sample recorded 65 intervals, 60fps average, no intervals over 22ms and a 16.8ms maximum. Scroll remained unlocked after the modal closed. No animations remained running after settlement. This is a local sample, not a real-phone performance guarantee.
- All five source/output hashes matched. Prepared images contain no EXIF metadata. The approved motion HTML, CSS and JavaScript still match `df8a54c`; the new page's hero markup is identical.
- JavaScript syntax, unique anchor targets, whitespace and the informational theme audit passed. The default audit scans application files, so prototype colours were classified separately. Coral/cyan are inherited tenant art-direction studies; ink, white, `#45606a`, `#ccd9df` and the ink backdrop are product neutrals. Status/grade colours are unchanged. New body text combinations exceed 4.5:1 contrast.

Eight PNG captures and `verification.json` are in `deliverables/obhis-homepage-review/`. Section-only captures temporarily hide the sticky header to prevent it covering the crop. The page itself keeps the header.

One inherited accessibility finding remains outside this continuation. White display text on the approved Olive coral measures 2.96:1, slightly below the 3:1 large-text threshold. The approved hero remains untouched here. Resolve that contrast before publication, alongside real-device and production accessibility review.

## Publication boundary

This is a local review page, not an authenticated publication system. `noindex` discourages indexing; it is not access control. Do not upload it publicly while source facts or child-photo permissions are unresolved.

Production integration still belongs in the existing shared school-site core. It must use an explicitly published content pack and the canonical admissions resolver, not a live Admin or private Convex source. See `docs/clients/obhis/OBHISContentApprovalSheet.md` for the outstanding content approvals.
