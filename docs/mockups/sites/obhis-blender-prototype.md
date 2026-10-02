# Olive Blender hero prototype

Open `obhis-blender-prototype.html` in a browser. No install or server is needed. This is a private design study, not the school website.

B is shown first. Use **View from above** and **Take a seat** to switch between two actual Blender renders of the same illustrated table. The change is user-controlled, not an automatic carousel. The original A layout remains available through the bottom comparison arrows.

Shareable states:

- `?variant=B&view=overhead`
- `?variant=B&view=perspective`
- `?variant=A`

## What is real

The shared table, curved chair backs, cloth runner, colour pieces, camera views, and studio lighting were created in Blender 5.2.2 through MCP. Final transparent PNGs are 960 × 786 at 24 Eevee samples. The page uses smaller WebP copies of those PNGs, about 47 KB and 63 KB. There is no real-time browser 3D rendering.

This is an imagined scene. It does not depict the actual campus, school furniture, or pupil work. The original uniform-inspired texture is artwork, not a textile scan. The school photographs and logo retain the provenance and publication limits documented in `obhis-homepage-prototype.md`. Copy and school details remain draft. No live application form or configured admissions link is present.

## Safety and preservation

The original vector draft is preserved unchanged in local commit `03cbd25`.

The corrected modelling script created a separate 48-object scene. The original active `Scene`, with its `Cube`, `Light`, and `Camera`, stayed unchanged. Modelling and rendering ran as separate steps. No `.blend` file was exported or saved after the earlier library-export crash.

Reproduction scripts, the generated pattern, original PNGs, and the crash/recovery note are under `obhis-blender-study/`. The model is currently in memory in Blender; the scripts preserve how to recreate it. Do not use the removed `bpy.data.libraries.write` operation.

## Motion and verification

The hero uses one state-controlled CSS opacity crossfade between baked images. Reduced motion disables the transition. It adds no animation loop, smooth-scroll engine, Canvas, WebGL, or new dependency. This applies the coordinated-state and accessible-equivalent constraints in the creative-web-development motion and performance references.

Python Playwright checks passed for both layouts at 1440, 390, and 320 pixels, with no horizontal overflow, missing images, or page errors. B's default state, view buttons, pressed-state labels, URL/reload persistence, keyboard comparison, reduced-motion transition, and admissions placeholder navigation passed. Desktop/mobile PNG captures are in `deliverables/obhis-blender-concepts/` within the worktree.

These checks do not certify production accessibility or performance. Theme colours are fixed art-direction studies, not new tenant settings. Production styling still needs approved primary/accent values and `@school/shared/theme`.
