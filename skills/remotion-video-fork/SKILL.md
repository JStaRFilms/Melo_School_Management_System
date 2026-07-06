---
name: remotion-video-fork
description: Preserve-real-UI workflow for turning an existing app project into a Remotion/video-production fork. Use when the user wants videos that reuse the exact app UI composition, strip auth/database/connectors, replace live backends with mock/local data, script navigation/clicks/transitions, or prevent agents from remaking/redesigning screens for Remotion.
---

# Remotion Video Fork Workflow

## Core Rule

Preserve the app's existing UI composition. Replace runtime dependencies, data sources, auth, and connectors; do not remake screens unless the user explicitly asks for a new design.

## Non-negotiables

- Treat the current repository as a video-production fork when the user confirms it is cloned for this purpose.
- Keep real pages, layouts, components, shared navigation, styling, and visual hierarchy intact.
- Do not create Remotion-only clone dashboards as the default approach.
- Do not redesign dashboards, sidebars, cards, tables, report cards, or flows just because video rendering needs mock data.
- Prefer extracting data/provider boundaries over rewriting JSX.
- Replace Convex/auth/payment/AI/external connector behavior with deterministic mock or local adapters.
- In this video fork, mock/demo mode may be the default even when old live `.env` values exist; require an explicit opt-out for live backends.
- Never expose "demo", "mock", "fake", "video mode", or other implementation wording in the user-facing UI; the app should look like a real production school portal.
- Populate demo states with believable placeholder data, avatars, school branding, payments, notices, results, and report cards.
- Make video flows repeatable and scriptable.
- Prefer code-native Remotion compositions that import/render real app components over screenshots or screen capture. Screen capture is only a diagnostic/reference fallback, not the main production workflow.

## Recommended Architecture

Use a video/demo data layer:

```txt
real app UI
  -> thin live/mock data boundary
    -> live Convex/auth/connectors OR video mock data/local fixtures
  -> scripted route/click/timing flow
  -> Remotion/Playwright capture/render pipeline
```

Start in the fork with the simplest safe version. Only backport abstractions to the original production app after the workflow proves useful.

## Workflow

1. Inspect before editing.
   - Identify routes, layouts, data hooks, auth guards, and external connectors.
   - List exact files that block mock/video rendering.
   - Confirm whether the current repo is the video fork before broad stripping.

2. Preserve visual components.
   - Find the real page/component that owns the UI.
   - Split only if needed: `LiveContainer` loads data; presentational component receives props.
   - Keep class names, component layout, spacing, and shared UI imports.

3. Bypass auth in video mode.
   - Provide a fake session with realistic user, role, school, and image.
   - Disable redirects and loading gates for video mode.
   - Keep sign-out/profile UI visually present if it appears in the real app.

4. Replace live data.
   - Replace `useQuery`, `useMutation`, `useAction`, server fetches, and connector calls at the boundary.
   - Use deterministic mock fixtures, not random-at-render data, unless seeded.
   - For mutations/actions, simulate latency and optimistic state where useful for video interactions.

5. Replace external connectors.
   - Payment providers, upload APIs, AI generation, email/SMS, OCR, webhooks, and storage should become fake local handlers or no-op adapters with visible success/failure states.

6. Script video flows.
   - Prefer scripted interactions over manual recording for repeatability.
   - Main production path: import/render real app components inside Remotion and drive them with props, providers, timeline state, and simulated interactions.
   - Use Playwright/screenshot capture only as a diagnostic/reference fallback, not as the main video construction method.
   - For this project, `pnpm video:portal:flow` captures reference artifacts into `artifacts/portal-parent-flow`; do not treat those artifacts as the source of the final Remotion composition.
   - Use Remotion for timing, camera/pan overlays, captions, cursor choreography, route/state choreography, and final render composition.

7. Verify.
   - Run targeted typecheck/build for the app being touched.
   - Start the relevant Next app when needed and verify target routes render with no live env.
   - For Remotion changes, verify the composition starts and renders at least a still/frame when practical.

## Current Project Map

- Monorepo workspaces: `apps/admin`, `apps/teacher`, `apps/portal`, `apps/platform`, `apps/www`, `packages/shared`, `packages/auth`, `packages/convex`.
- Existing Remotion lives in `apps/www/remotion`.
- Existing Remotion components currently include recreated screens such as `VideoAdminDashboard`, `VideoBillingDashboard`, and `VideoPortalDashboard`; treat these as legacy/reference, not the preferred pattern.
- Shared workspace shell/navigation lives in `packages/shared/src/components/WorkspaceNavbar.tsx` and `packages/shared/src/workspace-navigation.ts`.
- Portal dashboard is the easiest first real-UI target:
  - `apps/portal/app/(portal)/components/PortalWorkspace.tsx`
  - `apps/portal/app/(portal)/components/portal-workspace/PortalWorkspaceContent.tsx`
  - `apps/portal/app/(portal)/layout.tsx`
  - `apps/portal/lib/AuthProvider.tsx`
  - `apps/portal/lib/ConvexClientProvider.tsx`
- Existing mock data patterns:
  - `apps/admin/lib/mock-data.ts`
  - `apps/teacher/lib/mock-exam-data.ts`
  - `apps/portal/app/(portal)/components/portal-workspace/PortalPreview.tsx` is only a placeholder fallback and should be replaced with full mock UI data when working on portal video mode.

## First Target Recommendation

For the parent dashboard flow, refactor the portal so the real `PortalWorkspaceContent` UI can render from mock props/data without Convex:

- Keep the visible JSX/UI structure.
- Move Convex queries/actions into a live wrapper or hook.
- Add a mock provider/hook returning full `PortalWorkspaceData` and `PortalBillingData`.
- Fake parent/student session and school branding.
- Make routes `/`, `/results`, `/report-cards`, `/notifications`, and `/billing` render without auth or Convex in video mode.
- For this portal fork, `NEXT_PUBLIC_PORTAL_DEMO_MODE` defaults to demo/mock mode; set it to `false` only for intentional live Convex testing.

## Skill Maintenance

When the user adds a preference, correction, or workflow rule during this project, update this `SKILL.md` immediately before continuing implementation. Keep updates concise and operational. If a rule prevents common agent mistakes, add it under Non-negotiables.
