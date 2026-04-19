I need you to work on this page. The problems include spacing, overuse of cards, and potential overuse of typography, explaining things that aren't meant to be explained for some weird reason. So please fix the route entirely and make sure it matches the admin routes closely if possible. Or you can propose another design if you think it's better.

---

Universal Task: Implement High-Fidelity Hybrid Editor

Refactor the [Route/Page Name] to strictly follow the Hybrid Academic Interface standard in docs/features/Hybrid_Academic_Interface.md.

1. Data Integrity & Persistence:

Implement an activeRecord (or activePerson/activeSubject) local state. Use a useEffect to capture the selectedRecord whenever it is set.
In the AdminSheet: Map the form to the activeRecord instead of the raw selectedRecord. This ensures the form stays populated during the 500ms slide-down animation (preventing the sheet from jumping or collapsing).
2. Smart Focus (Auto-Scroll):

Add a unique ID to each record card (e.g., id={"teacher-" + teacher._id}).
Add a useEffect to the main page that smoothly scrolls to the selected card on mobile (innerWidth < 1024). Use a yOffset of approximately -120px to position the card perfectly in the "open space" above the sheet.
3. Component Refactoring:

Update the Edit Form to support a variant="sheet" prop to strip internal surfaces/headers.
Ensure AdminSheet uses the standard 500ms cubic-bezier transition synced with its React unmount timer.
Canonical Source: Use apps/admin/app/academic/subjects/page.tsx as the reference for state preservation and auto-scrolling logic.

---

**Task:** Refactor the current page to use the "Independent Scroll Workbench" pattern.
> 
> **Architectural Constraints:**
> 1. Wrap the entire return block in a container that is `lg:h-screen lg:overflow-hidden flex flex-col`.
> 2. Implement the "Split Bucket" strategy:
>    - Create two main children in a `flex-row-reverse` container.
>    - **Sidebar Bucket:** `w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl`.
>    - **Main Bucket:** `flex-1 lg:h-full lg:overflow-y-auto`.
> 3. Inside the **Main Bucket**, wrap content in a `max-w-[1200px] mx-auto` div to maintain grid density.
> 4. Ensure mobile responsiveness: on `< LG` widths, the buckets should stack naturally and the page should regain normal vertical scrolling.
> 5. **Ghost Scrollbars:** Inject a `<style>` block to make the `custom-scrollbar` class `5px` wide, transparent by default, and visible only as `rgba(15, 23, 42, 0.15)` on hover.


---

You are implementing an approved homepage redesign for the public marketing site in this repo.

## Mission

Redesign the landing page in `apps/www` so it feels premium, distinctive, and highly trustworthy for serious Nigerian school operators.

The visual direction is already approved in:

- `docs/features/PublicLandingPageRedesign.md`

Use the gathered 21st-inspired source material in:

- `docs/design/21dev.md`

Very important:
The user wants the final result to stay **as close as reasonably possible** to the selected gathered component directions so the page feels clean, polished, and high-fidelity, not like a loose reinterpretation.

This is a build task, not a planning task.

---

## Read First

Before editing, read these files:

- `docs/project_requirements.md`
- `docs/features/PublicLandingPageRedesign.md`
- `docs/features/PublicSiteAndSeoFoundation.md`
- `docs/design/21dev.md`
- `apps/www/app/page.tsx`
- `apps/www/app/layout.tsx`
- `apps/www/app/globals.css`
- `apps/www/lib/site.ts`
- `apps/www/lib/site-ui.tsx`
- `apps/www/package.json`

Repo policy notes:
- This repo follows the blueprint/documentation rules in `AGENTS.md`.
- Keep files modular and avoid large monolithic files.
- If any code file approaches 200 lines, split it.
- If you touch any Convex code, read `packages/convex/_generated/ai/guidelines.md` first.
- At the very end, run `pnpm convex deploy` per repo policy and report whether it succeeded.

---

## Design Direction To Implement

Implement the approved “Floating Observatory” direction from `docs/features/PublicLandingPageRedesign.md`.

The homepage should have this overall flow:

1. Floating or dock-like entry/navigation treatment instead of a standard header feel.
2. Hero as an event, not a generic centered SaaS hero.
3. A framed product reveal section with controlled motion.
4. One scroll-led expansion moment.
5. A compressed proof/trust band.
6. An asymmetric capability composition instead of equal feature cards.
7. A calm, premium closing CTA.

Use the gathered component references in `docs/design/21dev.md` as the closest visual basis for:

- dock-like/floating navigation
- woven/luminous hero atmosphere
- framed scroll reveal
- controlled expansion section

Do **not** default back to a standard “hero, cards, cards, CTA” SaaS page.

Do **not** use the cosmic/space direction literally.
Do **not** make it look like a personal portfolio.
Do **not** overload the page with gimmicky motion.

---

## Fidelity Rules

Stay close to the gathered component language, especially in:
- silhouette
- spacing
- motion rhythm
- visual layering
- overall cleanliness

But adapt carefully to this repo’s actual design system:
- existing Melo color tokens in `apps/www/app/globals.css`
- existing shared utilities/components in `apps/www/lib/site-ui.tsx`
- existing content structures in `apps/www/lib/site.ts`

Priority order:
1. Clean, high-end visual result
2. Faithfulness to the approved direction and gathered components
3. Maintainability inside this repo
4. Mobile responsiveness and performance

If a source component is too literal, too noisy, or too heavy, adapt it while preserving the same feeling.

---

## Technical Expectations

- Use TypeScript.
- Keep the implementation modular.
- Extract homepage-specific sections/components instead of keeping everything in `apps/www/app/page.tsx`.
- Reuse shared wrappers like `Container`, `ButtonLink`, `GoldButton`, and `SectionLabel` where it helps.
- Update `apps/www/lib/site.ts` if the new homepage needs new content structures, metrics, or copy blocks.
- Update `apps/www/lib/site-ui.tsx` only if the redesign requires shared public-site shell changes.
- Update `apps/www/app/layout.tsx` only if the floating entry/navigation treatment requires it.

Animation guidance:
- Prefer CSS and/or lightweight motion where possible.
- Add dependencies only if they materially improve fidelity.
- Keep mobile performance acceptable.
- Respect reduced-motion behavior.

---

## Content Guidance

Copy must feel grounded in real school operations.

Emphasize:
- admin, academics, billing, and parent communication in one platform
- product seriousness
- operational clarity
- Nigerian school relevance
- trust and professionalism

Avoid:
- vague innovation slogans
- generic “future of education” copy
- crypto/startup visual language
- hype without operational specificity

---

## Suggested File Structure

You do not have to use these exact names, but keep things organized. Likely candidates:

- `apps/www/app/page.tsx`
- `apps/www/components/public/landing/floating-entry.tsx`
- `apps/www/components/public/landing/hero-event.tsx`
- `apps/www/components/public/landing/framed-reveal.tsx`
- `apps/www/components/public/landing/proof-band.tsx`
- `apps/www/components/public/landing/capability-composition.tsx`
- `apps/www/components/public/landing/final-cta.tsx`

Adjust to the repo’s actual structure if a better local convention already exists.

---

## Deliverables

Implement the redesign end-to-end.

At minimum:
- redesign the homepage
- keep it mobile-friendly
- preserve metadata/public marketing behavior
- keep the public marketing site clearly separate from tenant school sites
- keep CTAs pointing to public marketing flows, not internal workspace implementation details

Also:
- update docs if implementation meaningfully changes the approved brief
- summarize what changed and any assumptions made

---

## Validation

Run the relevant checks after implementation.

At minimum run:
- `pnpm --filter @school/www typecheck`
- `pnpm --filter @school/www lint`

If there is a practical way to run/build the page locally, do so and sanity check layout behavior.

Then, immediately before handoff, run:
- `pnpm convex deploy`

If `pnpm convex deploy` fails, do not hide it. Report the failure clearly.

---

## Final Output Format

When done, report:
1. What you changed
2. Which files you created/updated
3. Any dependencies added
4. Validation results
5. `pnpm convex deploy` result
6. Any residual risks or polish items

Do not stop at planning. Implement the approved redesign.
