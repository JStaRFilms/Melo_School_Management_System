# Feature: Admin Portal UI/UX Overhaul

## Status: Phase 2 (Core Layout & Component Language) - COMPLETE
**Current Date:** March 29, 2026
**Lead Agent:** Gemini (Principal Full-Stack Architect)

---

## ✅ Progress Update

### Phase 1: Global Navigation & Shell
- [x] **1.1 Tokenization:** Moved to CSS variables and Tailwind extensions.
- [x] **1.2 Desktop Refinement:** Slimmed navbar and refined profile lockup.
- [x] **1.3 Mobile Overhaul:** Native-feel transitions and haptic-style feedback implemented.

### Phase 2: Core Layout & Component Language
- [x] **2.1 Shared Layouts:** Refactored `app/admin/page.tsx` with high-density spacing (`px-4` on mobile).
- [x] **2.2 New Component Primitives:**
    - `AdminSurface`: Replaced "bubbly" cards with refined, intensity-based layering.
    - `AdminHeader`: Compact, Space Grotesk-driven typography.
    - `StatGroup`: High-density, row-based stat blocks with horizontal scrolling on mobile.
- [x] **2.3 Mobile-First Action Hierarchy:** 
    - Reordered layout: Creation/Promotion forms appear first on mobile for immediate action.
    - Directory list moved to the bottom on mobile, side-by-side on desktop.
- [x] **2.4 Anti-Slop Text Audit:** Stripped verbose "manual-style" copy across all admin components.

---

## 🎨 Design System State

- **Mobile Pattern:** **The High-Density List.** Cards on mobile should have minimal padding (`p-3`), smaller text (`text-sm/xs`), and compact button layouts. Avoid vertical dead space at all costs.
- **Hierarchy:** Primary actions (Forms) should be at the top on mobile, Sidebar on desktop.
- **Typography:** Space Grotesk (Bold) for headings, Public Sans (Medium/Bold) for data. Labels should be `text-[9px]` uppercase with `tracking-[0.2em]`.

---

## 🚀 Handover: Phase 3 (Route-by-Route Refactor)

The visual language is now established in `apps/admin/app/admin/`. The next agent should propagate this to the **Academic Setup** routes.

### Immediate Task: Refactor Academic Setup (`/sessions`, `/events`, `/subjects`)
1. **Kill the Cards:** Transition from standard cards to `AdminSurface`.
2. **Apply Hierarchy:** Use the mobile-first reordering (Actions at top, Lists at bottom).
3. **Density Check:** Use the new `px-4` mobile padding and high-density list items.
4. **No Slop:** Keep copy direct and utility-focused.

### Files to use as Reference:
- `apps/admin/app/admin/page.tsx` (Layout & Hierarchy)
- `apps/admin/app/admin/components/AdminCard.tsx` (List Item Pattern)
- `apps/admin/lib/components/ui/StatGroup.tsx` (Compact Stats)
