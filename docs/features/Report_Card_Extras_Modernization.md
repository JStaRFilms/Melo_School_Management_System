# Implementation Plan: Report Card Extras Modernization

## Goal

Transform the `/assessments/report-card-extras` interface from a verbose, card-heavy layout into a professional, high-density "Independent Scroll Workbench."

## Architecture: Split-Bucket Layout

We will implement the "Independent Scroll Workbench" pattern:
- **Root**: `lg:h-screen lg:overflow-hidden` container to lock the viewport.
- **Sidebar (Right Bucket)**: Sticky selection bar holding Session, Term, Class, and Student filters.
- **Main (Left Bucket)**: Independently scrolling workspace showing the `AdminHeader` and the actual Extras entry forms.

## Component Refinement


### 1. `AdminReportCardExtrasPage` (`page.tsx`)

- Implement the split-bucket layout shell.
- Inject "ghost scrollbar" styles for a clean aesthetic.
- Handle mobile responsiveness (stacking buckets).

### 2. `ExtrasSelectionBar` (`components/ExtrasSelectionBar.tsx`)

- Wrap in `AdminSurface` (low intensity).
- Refactor selectors for vertical density.
- Add a "Selection Protocol" label to align with admin UI standards.

### 3. `ExtrasWorkspace` (`components/ExtrasWorkspace.tsx`)

- Remove the redundant header card.
- Move informative text to the `AdminHeader` in the main page.
- Replace card-heavy bundles with `AdminSurface` containers.
- Implement a more subtle "Admin Override Active" indicator.
- Tighten field layout and remove verbose helper text where the label is sufficient.

## Visual Standards
- **Typography**: Optimized for data density.
- **Aesthetics**: Clean, surgical, using `slate` and `indigo/emerald` for accents.
- **Micro-interactions**: Subtle hover states and smooth transitions.

## Verification
- Run `npx tsc --noEmit` to ensure type safety.
- Verify mobile responsiveness (buckets stack correctly).
- Ensure independent scrolling works on desktop.
