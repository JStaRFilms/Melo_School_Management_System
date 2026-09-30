# Olive homepage concept comparison

Private, throwaway visual studies on branch `feature/obhis-website`. Neither direction is approved for implementation or publication.

## Open the comparison

Open `obhis-homepage-prototype.html` in a browser. No install or server is required.

Use the bottom arrows or the left/right keyboard keys to switch:

- `?variant=A`: bold and sculptural. A white composition, large display type, a perspective cyan table, and an empty chair.
- `?variant=B`: tactile and patterned. A coral field, overhead table illustration, uniform-inspired fabric, and a photographic print.

The question is whether either composition makes Olive feel welcoming and distinctive without turning the school into a generic education illustration. This comparison does not test the eventual animation.

## Asset sources and limits

- `school-logo.png` is an unchanged copy of `D:/JOHNSAX/Pictures/Logo/IMG-20230908-WA0010 - Copy-transparent.png`. The source is only 260 × 260. It is suitable for this small prototype placement, not a large rendered logo.
- `school-gathering.webp` is a resized, metadata-free review copy of `2026-07-12_school_visit/RAW/DSC04693.JPG` under the supplied OBHIS client folder.
- `classroom-moment.webp` is a resized, metadata-free review copy of `2026-07-12_school_visit/RAW/DSC04763.JPG` from the same folder.
- Both SVG table studies are original illustrations. Their fabric motifs take colour and shape cues from the uniforms. They do not reproduce the textile, represent pupil work, or model actual school facilities.

The photos are local review fixtures. Photographer rights, school approval, and consent to publish identifiable pupils remain unconfirmed. Do not deploy this prototype or its assets. School display name and copy remain draft. No addresses, fees, programmes, campus names, or admissions availability are inferred.

## Blender access

Blender is running and owns the local listener on port 9876. A read-only scene query timed out. Launching its Windows Store executable separately returned `Access denied`. No open scene was changed. These are SVG art studies, not Blender renders. Working isolated rendering access is still required before Blender asset production.

## Design constraints applied

- `frontend-ui/prototyping-variants/UI.md`: structurally different variants, shareable query state, a keyboard-capable comparison bar, and no real mutations. This standalone mockup follows the repository's existing `docs/mockups/sites` review convention rather than changing the generic tenant runtime.
- `frontend-ui/frontend-design/SKILL.md`: the actual uniforms lead the palette and fabric details. No beige wood default, stock globe/cap collection, or unrelated ornamental effects.
- `creative-web-development`: keep utility in readable HTML; identify illustrative media; do not invent school facts. Static imagery needs no browser rendering loop or GPU layer.
- Theme rules: this is fixed prototype art direction, not a new tenant settings model. Green and cyan are proposed primary/accent roles. Other illustration hues are tenant art studies; white, ink, and review controls are product neutrals. Production styling must use `@school/shared/theme` and the approved primary/accent values.

## Verification

Python Playwright checks passed for both variants at 1440, 390, and 320 pixels. Images load and retain their intended proportions, neither variant overflows horizontally, and only the selected concept is visible. Button and keyboard switching, query-state reload, reduced-motion rendering, and the admissions placeholder link passed with no page errors.

Desktop and mobile PNGs are in `deliverables/obhis-homepage-concepts/` within this worktree. The informational theme audit exited successfully. Its changed-file scan reports existing application colours rather than these untracked documentation mockups; prototype colour classification is recorded above. This is not a production accessibility or performance certification.

Do not promote the prototype directly to production. After a direction is selected, the school renderer must consume approved content and the shared admissions, domain, and publishing contracts.
