---
name: remotion-real-ui-video
description: Reusable workflow for turning an existing app into code-native Remotion videos that reuse the real UI instead of screenshots or recreated clone screens. Use when a user wants product demos, walkthroughs, onboarding videos, launch videos, or proof compositions from an existing React/Next/web app with mock/demo/local data, scripted navigation, click/touch choreography, responsive mobile proofs, scroll choreography, or calibrated cursor/tap targeting.
---

# Remotion Real UI Video Workflow

## Core Rule

Render the app's real UI in Remotion. Do not recreate clone screens, redesign dashboards, or rely on screenshots as the primary production path. Replace runtime/data boundaries with deterministic demo data so the existing components can render safely and repeatably.

## Non-negotiables

- Preserve the product's existing UI composition, layout hierarchy, shared components, styling, and navigation patterns.
- Do not build Remotion-only clone dashboards as the default approach.
- Do not redesign screens just because video rendering needs local data or scripted timing.
- Prefer extracting data/provider boundaries over rewriting JSX.
- Replace live runtime dependencies at the boundary: authentication/session, databases, external APIs, payment providers, uploads, analytics, webhooks, AI calls, and feature flags.
- Use believable deterministic demo data. Avoid random-at-render data unless seeded.
- Never expose implementation wording such as "demo", "mock", "fake", "video mode", or "test data" in user-facing UI unless the user explicitly wants that.
- Prefer code-native Remotion compositions that import/render real app components over screenshots or screen capture. Use Playwright/screenshots only as diagnostic/reference fallbacks.
- Drive cursor/touch movement, down/up frames, app reactions, route/state commits, and scroll/camera changes from centralized timeline objects.
- Route/data state must change only at a commit frame after the visual click/tap has landed.
- Prefer semantic DOM target tracking (`data-video-target`) over raw coordinates; raw coordinates are fallbacks only.
- Normalize DOM measurements into Remotion composition coordinates before positioning cursors, touches, debug overlays, or highlights.
- For Remotion-authored movement/scrolling, avoid CSS `transition`/browser-driven animation on properties that change every frame. Drive motion from frame values only.
- For mobile/tablet proofs, use separate Remotion compositions with intended viewport dimensions. Use full-screen app surfaces, touch indicators, and scripted scroll; avoid desktop pan/zoom and mouse cursors.

## Recommended Architecture

Use a video/demo data layer around the real app UI:

```txt
real app UI components
  -> thin runtime/data boundary
    -> live providers OR demo/local providers
  -> scripted route/state/timeline layer
  -> Remotion composition
  -> optional debug overlays/reference captures
```

When starting from an app with tightly coupled data/auth, split containers from presentational components:

```txt
LivePage/LiveContainer
  -> loads auth/session/live data
  -> calls actions/mutations
  -> renders RealFeatureView props

RemotionComposition
  -> imports RealFeatureView
  -> supplies demo data + no-op/demo actions
  -> drives state from timeline commit frames
```

## Workflow

1. Inspect before editing.
   - Identify the real routes/components that own the target UI.
   - Identify data hooks, auth guards, providers, live API calls, browser-only assumptions, and external connectors.
   - List the smallest boundaries that must be replaced for Remotion rendering.

2. Preserve real UI components.
   - Keep class names, component structure, spacing, and shared UI imports.
   - Extract presentational views only when necessary.
   - Do not replace complex real screens with simplified video-only copies unless the user explicitly requests a redesign.

3. Create deterministic demo runtime/data.
   - Provide local/demo sessions, users, accounts, projects, plans, records, notifications, payments, activity, or whatever domain entities the UI expects.
   - Simulate loading, success, failure, empty, and optimistic states when useful for the video.
   - Replace live mutations/actions with local no-op or scripted state changes.
   - Keep user-facing copy production-like, not labeled as mock/demo.

4. Build a code-native Remotion bridge.
   - Import the real UI view/component into a Remotion composition.
   - Provide required providers, styles, aliases/stubs, and local data.
   - Stub framework integrations as needed, e.g. routing/link/navigation modules, image/font loaders, analytics, or server-only APIs.
   - Keep Remotion-specific code around the UI, not inside every component.

5. Script interactions with a centralized timeline.
   - Define named actions with `targetId`, fallback coordinates, `downFrame`, `upFrame`, and `commitFrame`.
   - Derive route/view/data state from frame and commit frames.
   - Make click/tap visibly land before route/data state changes.
   - Keep timing constants readable and named so the user can tune them in Remotion Studio.

6. Use semantic target measurement.
   - Add `data-video-target="meaningful-id"` to the real clickable/focusable UI element.
   - Measure target boxes at render time with `getBoundingClientRect()`.
   - Convert viewport/Studio-scaled pixels into composition pixels relative to a `data-video-coordinate-root` using `useVideoConfig()` width/height.
   - Position cursor/touch indicators at the normalized target center.
   - Render optional debug target overlays in the same normalized coordinate space.

7. Handle responsive/mobile separately.
   - Create a dedicated mobile/tablet composition with realistic viewport dimensions.
   - Add mobile-only targets for drawer links, bottom tabs, cards, and stacked rows that replace desktop sidebars/tables.
   - Use touch/tap indicators, not mouse cursors.
   - Drive drawer/menu open state from timeline commit frames.
   - For long pages, drive vertical scroll from timeline state with deterministic transforms such as `translate3d(...)`; avoid CSS transitions on frame-driven transforms.

8. Verify.
   - Run targeted typecheck/build for touched packages.
   - Render stills at each important click/tap/down/commit frame.
   - Render a debug-overlay still to confirm targets and cursor/touch indicators share the same coordinate space.
   - Render the final composition after stills look correct.

## Implementation Patterns

### Timeline action shape

```ts
type VideoAction = {
  id: string;
  label: string;
  target: {
    frame: number;
    targetId: string;
    x: number; // fallback only
    y: number; // fallback only
  };
  downFrame: number;
  upFrame: number;
  commitFrame: number;
};
```

### Coordinate normalization pattern

```ts
const targetRect = target.getBoundingClientRect();
const rootRect = root.getBoundingClientRect();
const scaleX = rootRect.width / compositionWidth;
const scaleY = rootRect.height / compositionHeight;

const normalized = {
  x: (targetRect.left - rootRect.left) / scaleX,
  y: (targetRect.top - rootRect.top) / scaleY,
  width: targetRect.width / scaleX,
  height: targetRect.height / scaleY,
};
```

### Frame-driven scroll pattern

```ts
const scrollY = interpolate(frame, [start, end], [0, 240], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

<div style={{ transform: `translate3d(0, ${-Math.round(scrollY)}px, 0)` }} />
```

Do not add CSS `transition` to the same transform; Remotion is already sampling exact frames.

## Common Pitfalls

- Recreating screens instead of importing real components.
- Putting demo/auth/video labels in user-facing UI.
- Hardcoding click coordinates without semantic target measurement.
- Using raw `getBoundingClientRect()` values directly in cursor transforms; Studio preview scaling will make clicks drift.
- Measuring targets in one coordinate space while rendering overlays/cursors in another.
- Changing UI state at click-down instead of after click-up.
- Using desktop cursor/pan/zoom language for mobile proofs.
- Adding CSS transitions to frame-driven Remotion transforms, causing scroll or camera jitter.
- Letting real auth, database, payments, uploads, or analytics execute during video rendering.

## Skill Maintenance

When a user adds a reusable preference, correction, or workflow rule while building Remotion videos, update this skill if the rule is project-agnostic. Keep project-specific routes, filenames, brands, and domain entities out of this generic skill; those belong in project-local skills or documentation.
