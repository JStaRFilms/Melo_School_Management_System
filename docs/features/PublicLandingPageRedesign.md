# Public Landing Page Redesign

## Goal

Redesign the SchoolOS marketing homepage in `apps/www` so the first impression feels premium, memorable, and trust-building instead of conventional SaaS.

The homepage should feel like a high-value digital product built for serious school operators in Nigeria:

- visually distinctive without becoming noisy
- confident and editorial rather than generic startup-like
- motion-led, but still readable and conversion-focused
- clearly separated from tenant school public websites in `apps/sites`

This redesign is specifically for the main public landing page in `apps/www/app/page.tsx`.

---

## Scope Boundary

This feature covers:

- homepage visual redesign in `apps/www/app/page.tsx`
- homepage section order and storytelling flow
- homepage-specific motion, layout, and component composition
- updates to supporting homepage copy/data in shared `apps/www/lib/site.ts` structures when needed
- refinement of the public marketing shell if the homepage requires matching navigation or CTA treatment

It does **not** include:

- redesign of all supporting marketing pages
- tenant school website templates in `apps/sites`
- Convex schema or backend changes
- form backend behavior
- pricing or contact workflow implementation changes
- admissions workflow automation

---

## Design Intent

The landing page should communicate:

- this is not a template website
- this team understands real school operations
- the product is elegant, disciplined, and expensive in the right way

The emotional target is:

- first impression: curiosity
- second impression: confidence
- third impression: trust

The page should avoid a default sequence of:

- standard full-width navbar
- centered hero
- generic 3-column features
- testimonial strip
- plain CTA footer

Instead, it should feel like a guided experience with rhythm, compression, and reveal.

---

## Visual Direction

### Core Tone

- premium institutional
- cinematic but restrained
- editorial typography over flashy gimmicks
- motion used to reveal meaning, not decorate empty space

### Interaction Direction

- floating or dock-like navigation instead of a default top bar
- one immersive opening moment
- one controlled scroll-driven reveal
- asymmetric composition in the middle of the page
- a calm, decisive close

### Visual Guardrails

- no purple-heavy AI aesthetic
- no crypto-like neon overload
- no “space startup” brand language
- no abstract visuals that overpower the school/product story
- no card grid that feels interchangeable with any SaaS template

---

## Selected 21st-Inspired Patterns

The redesign should use the gathered references as inspiration, not literal copy-paste composition.

### Keep

- floating dock navigation language from the animated dock direction
- the ambition and atmosphere of the woven-light hero direction
- one perspective-based reveal from the container-scroll pattern
- one controlled expansion moment from the scroll-expansion pattern

### Do Not Use As The Main Direction

- full cosmic/space hero treatment from the horizon hero concept
- spooky smoke or novelty shader effects
- generic modern SaaS hero layouts
- anything that reads like a personal portfolio instead of an operating system for schools

---

## Components

### Client

- `apps/www/app/page.tsx`
- homepage-specific presentation components extracted as needed under `apps/www/components/` or the existing local public-site component structure
- motion-driven homepage sections for:
  - floating navigation treatment
  - hero atmosphere/reveal
  - framed platform reveal
  - proof/stat band
  - asymmetric capability composition
  - closing CTA

### Shared Marketing Content

- `apps/www/lib/site.ts`
- any shared homepage content arrays, metrics, labels, or CTA content required by the new composition

### Shared UI

- `apps/www/lib/site-ui.tsx`
- shared public-site wrappers or button primitives only if the redesign requires them

### Server

- Next.js metadata behavior already attached to the homepage route
- no new server logic is required for this redesign

---

## Data Flow

1. The homepage continues to load shared brand, metadata, CTA, and product-story content from the marketing content layer.
2. The redesigned page composes that content into a more cinematic sequence rather than a standard stacked landing page.
3. Motion and layout transitions guide the visitor from emotional entry into operational proof.
4. The page ends in a clear conversion path to demo/pricing/contact actions without exposing internal workspace routes.

---

## Database Schema

No database or Convex schema changes are required.

The redesign remains a presentation-layer feature on top of existing marketing content structures.

---

## Proposed Page Composition

### 1. Floating Entry Layer

Replace the feeling of a standard navbar with a lighter floating dock or hovering navigation treatment.

Purpose:

- feel curated and modern immediately
- reduce the “template website” signal
- keep primary actions visible without dominating the screen

### 2. Hero As An Event

The hero should feel like a visual event rather than a banner.

Structure:

- strong editorial headline
- restrained subline grounded in school operations
- one primary CTA and one secondary CTA
- luminous or textured background system that feels alive but controlled

The hero should sell trust and product seriousness, not just visual style.

### 3. Framed Product Reveal

Use a perspective or container-scroll moment to introduce the product interface as something being unveiled.

Purpose:

- move from emotion into product credibility
- present the platform as composed, capable, and thoughtfully designed

### 4. Expansion Story Moment

Use one scroll-led expansion section where a school-life moment transitions into platform capability.

Examples of the narrative bridge:

- from school complexity to operational clarity
- from scattered work to one unified system
- from paper-heavy workflows to a confident digital command center

This should happen once and feel intentional.

### 5. Proof Band

After the expressive moments, compress into hard proof:

- uptime or reliability cues
- billing or results workflow clarity
- school-operations specificity
- security and multi-role visibility

This section should feel factual, not decorative.

### 6. Asymmetric Capability Composition

Instead of equal feature cards, use a more curated layout:

- one dominant capability block
- supporting capability fragments
- selective metrics or short statements
- varied density across the grid

This is where “everything your school needs” becomes believable.

### 7. Ceremonial Close

End with a clean, powerful CTA block.

Tone:

- calm
- premium
- direct

It should feel like an invitation into a serious working relationship, not a last-minute sales prompt.

---

## Content Direction

Homepage copy should stay product-facing and operator-facing.

It should emphasize:

- Nigerian school operational realities
- admin, academics, billing, and communication in one system
- confidence, control, and clarity
- trustworthiness over hype

It should avoid:

- vague innovation language
- generic future-of-education slogans
- language that sounds detached from real school workflows

---

## Implementation Notes

### Recommended Structure

If the page grows in complexity, split homepage-specific pieces into focused modules instead of keeping all layout, motion, and content wiring inside one large file.

Likely split candidates:

- floating navigation treatment
- hero composition
- framed reveal section
- proof band
- capability composition
- final CTA

This keeps the homepage aligned with the 200-line modularity rule.

### Motion Rules

- motion should support narrative flow
- avoid stacking several heavy animated systems at once
- keep mobile performance and readability intact
- provide graceful static fallbacks where motion is reduced

---

## Regression Checks

- The page must remain clearly separate from tenant school websites in `apps/sites`.
- Public CTAs must not leak internal workspace or `/schools` implementation details.
- The homepage must stay mobile-first and readable on small screens.
- Motion must not reduce conversion clarity or accessibility.
- The visual system must feel more distinctive than the current page without becoming harder to maintain.
- Shared marketing content should remain reusable for other public pages where possible.

---

## Definition Of Done

- A single, approved homepage direction replaces the current conventional landing-page structure.
- The page has a distinctive visual identity anchored in trust and product seriousness.
- The final composition includes a floating entry, immersive hero, framed reveal, proof layer, asymmetric capability layout, and strong closing CTA.
- Homepage code is modularized if complexity grows beyond a maintainable single-file structure.
- Marketing copy remains product-facing and grounded in real school operations.
- The redesign preserves metadata behavior and public-site separation boundaries.
