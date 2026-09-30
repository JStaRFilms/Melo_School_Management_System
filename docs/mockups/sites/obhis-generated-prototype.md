# Olive generated-artwork prototype

Open `obhis-generated-prototype.html`. It is a standalone private browser draft, not the production school website. B opens first. `?variant=A` opens the white You hero; `?variant=B` opens the coral Olive hero. The arrows and keyboard controls switch layouts.

## Companion heroes

A now uses the user's cyan, coral and gold paper `you` artwork. Its white studio background and contact shadows are retained without requesting another generation or inventing transparency. A's old Blender chair, mint backdrop and annotation arrow are removed. The hero uses two columns on desktop and stacks on mobile, keeping the artwork clear of the headline and inside the viewport. A small caption replaces the old scene annotations.

B's markup and CSS were checked against their pre-A SHA-256 values and remain unchanged. B uses the user's generated fabric-and-paper artwork. The heading, coral field, official logo, navigation and school-photo collage remain. The redundant sticky note and the old camera-view controls were removed. One generated image cannot honestly provide two camera angles.

On desktop, the artwork meets the left and bottom hero edges. The photo overlaps its cropped right edge. On mobile, the artwork appears before the photo and spans the hero width, with a small overlap into the photo collage. Its full word remains visible.

No new motion was added. There is no WebGL, animation loop, asset-generation request, Blender execution, backend change or deployment in this pass.

## Artwork provenance

A's source is `E:/Downloads/ChatGPT Image Sep 30, 2026, 11_43_55 AM.png`, a 1402 × 1122 RGB image. An unchanged copy is archived as `you-source.png`. `prepare_you.py` crops empty studio space above and below, retaining the full width, object outlines and soft contact shadows. It creates `you-hero.webp`, 1402 × 700, 109,388 bytes. `you-provenance.json` records the source hash and crop. It is an opaque white-background image, not a transparent cutout.

B's two PNGs were supplied by the user:

- `E:/Downloads/ChatGPT Image Sep 30, 2026, 06_29_29 AM.png`, coral-background version.
- `E:/Downloads/ChatGPT Image Sep 30, 2026, 06_29_23 AM.png`, transparent version.

Both are 1448 × 1086. The second has real alpha transparency, but its removal process changed some interior RGB values and left faint background pixels. The serving asset keeps the first image's RGB and uses the second image's mask. Preparation removes low-alpha noise, normalizes near-opaque pixels, insets the mask by one pixel, and crops empty top space with 16 pixels of clearance.

Unchanged source copies, `prepare_hero.py`, and SHA-256 provenance are in `obhis-generated-study/`. The prepared `hero-cutout.webp` is 1448 × 781 and 148,756 bytes. The generation model is not independently verified.

This is imagined branded artwork. It does not depict the school's actual furniture, campus or pupil work. The fabric pattern is illustrative. The official green/gold logo remains unchanged. School photographs retain the pending publication and child-permission limits in `obhis-homepage-prototype.md`. School copy remains draft; campus and admissions destinations remain placeholders.

## Verification

Browser checks covered both A and B at 1440, 1024, 768, 760, 390 and 320 pixels. A's entire image fits the viewport without overlapping the copy. No horizontal overflow, missing images or page errors were found. Default B, A/B controls, reload state, URL state, keyboard switching, skip-link focus, reduced motion, admissions placeholder navigation and the no-JavaScript B fallback passed.

Review captures are in `deliverables/obhis-generated-concepts/`. They hide the private comparison toolbar so it does not cover the artwork. The HTML still has the toolbar.

The informational theme audit was run. Coral/cyan/gold are fixed tenant art-direction studies; ink, white and review controls are product neutrals. No semantic status or grade colours changed. Production theme values still need the shared theme derivation.

The checkpointed vector draft and existing Blender draft remain untouched. Source images in Downloads were only read, not modified. The user has approved both generated hero directions and their layouts. The approved stills are checkpointed locally in `7557e66`. Motion exploration now lives separately in `obhis-motion-prototype.html`; these still layouts remain unchanged. Production integration has not started. This approval does not confirm school copy, campus facts, admissions destinations or permission to publish school photographs.
