# Feature: Admin Portal UI/UX Overhaul

## Status: Planning & Research phase
**Lead Agent:** Gemini (Principal Full-Stack Architect)
**Core Skill:** `frontend-design`

---

## 🎯 Goal
Transform the Admin Portal from a repetitive, "bubbly" desktop-first interface into a high-end, mobile-intentional, and refined management system. We are moving away from "AI-generated default" aesthetics toward a custom, distinctive visual language.

## 🔍 Audit Findings (Current State)

### 1. "The Monotonous Bubble" Effect
- Every section (Header, Stats, Forms, Directory items) is trapped in identical `rounded-3xl` white cards with `p-5` padding.
- **Problem:** Zero visual hierarchy. The user is visually "shouted at" by every component simultaneously.

### 2. Typography Exhaustion
- Over-reliance on `font-black` and heavily tracked-out uppercase labels (`tracking-[0.14em]`).
- **Problem:** Visual noise. High-weight fonts should be used for impact, not for every label and title.

### 3. Poor Space Management
- Desktop headers and redundant stats consume ~40% of the initial viewport.
- Mobile experience is purely reactive (stacking) rather than intentional. It results in "infinite scrolling" with low information density.

### 4. Navigation (WorkspaceNavbar)
- Uses basic inline styles and hardcoded hex values.
- Mobile drawer feels like a generic template rather than a modern app navigation.

---

## 🎨 Aesthetic Direction (The Vision)

- **Style:** **Refined Utility / Editorial Minimalist.**
- **Typography:** Move away from generic Inter/System fonts. Pair a characterful display font (e.g., *Sora* or *Space Grotesk*) with a clean, high-legibility body font (e.g., *Public Sans*).
- **Spatial Composition:**
    - Use subtle depth (layered backgrounds) instead of heavy borders.
    - Vary border radiuses (sharper for utility, softer for interactive elements).
    - Introduce "Surface Level" hierarchy (e.g., `#f8fafc` background with pure white active surfaces).
- **Mobile First:** Custom mobile navigation (perhaps a floating dock or a high-end full-screen overlay) and dense, but readable, mobile list views.

---

## 🛠️ Implementation Roadmap

### Phase 1: Global Navigation & Shell (`WorkspaceNavbar`)
- [ ] **1.1 Tokenization:** Move from hardcoded styles to CSS variables/Tailwind theme extensions.
- [ ] **1.2 Desktop Refinement:** Slim down the navbar height and refine the logo/user-profile lockup.
- [ ] **1.3 Mobile Overhaul:** Rebuild the mobile navigation to feel like a native app (better transitions, haptic-style feedback, intentional layout).

### Phase 2: Core Layout & Component Language
- [ ] **2.1 Shared Layouts:** Refactor `app/admin/layout.tsx` to handle responsive padding and background layering.
- [ ] **2.2 New Component Primitives:**
    - `AdminSurface`: A smarter replacement for `AdminCard` with varying "intensities."
    - `AdminHeader`: A more compact, utility-focused header component.
    - `StatGroup`: A refined, grid-adaptive stat display.

### Phase 3: Route-by-Route Refactor
- [ ] **3.1 Admin Management (`/admin`):**
    - Split "Creation/Actions" into a collapsible or drawer-based system.
    - Transform the Directory into a high-density, searchable list (Data Table style).
- [ ] **3.2 Academic Setup:** Streamline enrollment and school provisioning flows.
- [ ] **3.3 Assessments:** Data-heavy view optimization for mobile.

---

## 📝 Guidelines for Future Agents
1. **Never guess the aesthetic:** Always activate the `frontend-design` skill and refer to this document.
2. **Kill the cards:** If you are adding a card, ask: "Can this be a surface, a list item, or just negative space?"
3. **Mobile is not an afterthought:** If a feature doesn't feel "good" on a phone, it's not finished.
4. **Precision over Weight:** Use `font-semibold` or `medium` with better tracking/color instead of defaulting to `font-black`.
