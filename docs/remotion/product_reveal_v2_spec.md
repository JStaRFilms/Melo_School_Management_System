# 🎬 Video Spec: Product Reveal V2

## Overview
| Property | Value |
|----------|-------|
| **Type** | Homepage Product Reveal |
| **Duration** | 11.4 seconds (342 frames @ 30fps) |
| **Resolution** | 1280x720 |
| **FPS** | 30 |
| **Composition ID** | `PlatformReveal` |

## Rules I Read Before Writing This Spec
- [x] animations.md
- [x] timing.md
- [x] sequencing.md
- [x] transitions.md
- [x] fonts.md
- [x] tailwind.md

## Creative Direction
A cinematic, high-fidelity walkthrough of the actual Melo platform. Moving away from synthetic placeholders to "video-safe" clones of real app UI. Focus on readability, depth, and operational trust.

### Color Palette (from Melo Design System)
| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #020617 | Sidebar, Headers |
| Accent | #3b82f6 | Active states, buttons |
| Background | #f8fafc | Canvas |
| Border | #e2e8f0 | Dividers |

### Typography
- **Plus Jakarta Sans / Inter**: Main UI text.
- **Bodoni Moda**: Highlights (if used).

---

## Scene Breakdown

### Scene 1: Admin Command (0s - 3s / 0-90f)
**Duration**: 3 seconds

#### Visual Elements
- `VideoWorkspaceNavbar` (Admin active).
- Sidebar: "Management", "Academic Operations", "Finance" groups.
- Dashboard: 4 Stat Cards (Students, Staff, Active Sessions, Revenue).
- A clean, actual-UI-matching "Recent Activity" table.

#### Animations
- **Entrance**: Spring fade-in and subtle scale-up (0.98 -> 1.0) of the whole shell.
- **Focus**: Slow pan (20px) from left to right over the dashboard.

---

### Scene 2: Academic Proof (3s - 6.5s / 90-195f)
**Duration**: 3.5 seconds

#### Visual Elements
- Transition to `Accountant/Teacher` view.
- Main focus: `ReportCardSheet` overlay.
- Real content: "Sarah Sunday", Term 1, Math: A, Science: B+.

#### Animations
- **Transition**: Smooth wipe/slide from Scene 1.
- **Reveal**: `ReportCardSheet` slides up from bottom (spring snappy).
- **Zoom**: Begin on the full report-extras workspace, then push into the report-card sheet so the student photo, header, and subject rows become clearly readable.

---

### Scene 3: Billing Clarity (6.5s - 9.5s / 195-285f)
**Duration**: 3 seconds

#### Visual Elements
- Transition to `BillingDashboard`.
- Focused view on "Fee Collection" vs "Outstanding".
- A "Recent Payments" feed with Paystack-style status badges.

#### Animations
- **Transition**: Fade cross-dissolve.
- **Interaction**: Cursor moves to a "Link Payment" button (minimal interaction).
- **Highlight**: Subtle glow on the "Total Collected" card.

---

### Scene 4: Parent Portal (9.5s - 12s / 285-360f)
**Duration**: 2.5 seconds

#### Visual Elements
- `VideoWorkspaceNavbar` (Portal mode - warmer colors).
- Dashboard card for a student ("David Sunday").
- "Fees Balance: ₦0.00" - Paid badge (Trust element).

#### Animations
- **Entrance**: Soft reveal.
- **Narrative**: One decisive frame showing "Transparency & Trust".

---

### Final Frame: The Command Surface (12s - 13s / 360-390f)
**Duration**: 1 second

#### Visual Elements
- Zoom out to show the full workspace layout once more.
- "Melo: The School Operating System" overlay (minimal).

---

## Technical Requirements

### Props Schema (Zod)
```ts
import { z } from "zod";
export const ProductRevealV2Schema = z.object({
  schoolName: z.string().default("Greenwood Academy"),
});
```

### Critical Rules
- ✅ REQUIRED: All animations via `useCurrentFrame()` + `interpolate()`/`spring()`
- ✅ REQUIRED: `premountFor={1 * fps}` on all `<Sequence>`
- ✅ REQUIRED: Custom `VideoSafe` components to avoid browser API side effects.
- ✅ FORBIDDEN: Real `next/navigation` or `next/image` inside Remotion. Use `Img` and mock components.
