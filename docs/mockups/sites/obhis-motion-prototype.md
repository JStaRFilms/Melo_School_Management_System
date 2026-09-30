# Olive and You motion prototype

## Scope and checkpoint

The approved still studies, source images and review captures are checkpointed locally in `7557e66`. Nothing was pushed. The vector checkpoint remains `03cbd25`. This pass creates a separate motion prototype, not a production renderer or a new school-content source.

One shared header and page surround two hero states. Olive introduces the school; You makes the invitation personal. The visitor chooses the change. There is no timed carousel, scroll gate, camera simulation or new artwork generation.

Campus/contact details and admissions destinations remain unconfirmed placeholders. School photographs remain private fixtures pending publication rights and child permissions. The generated artwork is imagined, not evidence of facilities or pupil work.

## Motion law

A white page moves across the coral composition. The You headline and artwork settle within that page. Returning to Olive reverses the same movement. The real logo, navigation and admissions link remain outside the moving stage. The stage keeps the larger composition's height so the shared page below does not jump.

The approved baked images move as complete images. They do not bend, spin as fake 3D objects, or interpolate between invented camera views. Native CSS transitions retarget from their current position when a visitor reverses the choice.

## Reference manifest and receipts

All references below were read completely before implementation.

- `creative-web-development/references/motion-and-scroll.md`: input must drive one coordinated state; visual text splitting must not fragment its accessible name. A single hero state drives the page movement and settling. Each headline keeps one intact accessible name. There is no separate ticker, scroll engine or per-letter animation system.
- `creative-web-development/references/performance-and-profiling.md`: reduced motion preserves the full experience; animated resources need a lifecycle. This prototype uses finite compositor transforms and opacity, no continuous loop or GPU scene. Reduced motion snaps to the complete selected state. Focus into moving content settles it, and lifecycle handling cancels the one-shot readiness frame.
- `creative-web-development/references/concept-evaluation.md`: a global draft notice does not excuse invented operational claims at the point of use. Campus and admissions sections retain explicit placeholders. The meaning is the school welcoming the individual, rather than an effect demonstration.

## Review risk

The stable stage deliberately gives the desktop You view more breathing room. On phones, a smaller version of the existing school-photo print fills the otherwise empty lower area. It uses the same private fixture and adds no new publication permission.

Real-device performance and production accessibility are not certified by a headless prototype check.

## How to review

Open `obhis-motion-prototype.html` in a browser. Choose **You**, then **Olive**, including a reversal before the movement finishes. Arrow keys switch only while focus is in those controls; Enter and Space also work. Navigation and admissions remain separate from the moving hero.

`?scene=you` opens directly in the settled You state. The selected state survives reload and browser history. Reduced motion shows the selected composition immediately. Without JavaScript, the Olive hero and school links remain usable and the inactive controls are hidden.

Static captures and `olive-to-you-motion.gif` are in `deliverables/obhis-motion-concepts/`. The GIF samples the browser's actual CSS transitions. It loops for review; the live page does not autoplay.

## Verification and constraint audit

- Both states passed at 1440, 1024, 768, 760, 390 and 320 pixels, with no horizontal overflow, missing images or page errors. The shared content moved 0px between states.
- Finite motion, rapid reversal, pressed states, inert inactive panels, one accessible heading, header admissions during transition, scoped keyboard input, focus settlement, history/reload, preference changes during motion, lifecycle cancellation and no-JavaScript fallback passed.
- A keyboard-focused moving link initially exposed a cancellation bug. Explicit `transition:none` in the non-moving rules now cancels running transitions when the readiness class is removed; the focused link is immediately visible. The focused regression check and the complete verification passed afterward.
- A short headless sample at 4× CPU throttling recorded 66 frame intervals, a 16.7ms median and 95th percentile, and no intervals over 50ms. This is a local sample, not a real-phone frame-rate guarantee.
- JavaScript syntax and the informational theme audit passed. Direct coral/cyan/gold are tenant art-direction studies; paper, ink and review chrome are product neutrals. Status and grade colours are unchanged.

The reference constraints remain observable: one state owns all motion; headings have intact accessible names; focus/reduced motion/lifecycle settlement are complete; there is no idle render loop or forced scroll journey. School facts and publication permission remain labelled at their point of use. Scope stops at the motion prototype.

The approved direction scores 3 or 4 across the concept rubric. Its strength is the uniform-derived material identity and the personal Olive/You handoff. Its weakness is that the welcome interaction supports the message rather than being necessary to understand it. A timed carousel was rejected because it would change the visitor's reading context without their choice.
