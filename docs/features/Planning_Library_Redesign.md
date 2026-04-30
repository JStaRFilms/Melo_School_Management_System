# Feature Blueprint: Teacher Planning Library Redesign

## Goal
Redesign the Teacher Planning Library (`/planning/library`) to align with the compact, professional aesthetic of the Admin portal. Address issues with spacing, card overuse, and excessive explanatory text.

## Problem Analysis
- **Low Information Density**: Large cards and generous padding waste space.
- **Inconsistent UI**: Uses custom components instead of the standardized Admin design system.
- **Cognitive Overload**: Explains simple concepts (e.g., processing status) in prominent UI blocks.
- **File Bloat**: The `page.tsx` is >2000 lines, making it difficult to maintain.

## Proposed Changes

### 1. Architecture Refactor
- Extract components to `apps/teacher/features/planning-library/components/`.
- Move business logic (mutations/queries) to specialized hooks.
- Keep `page.tsx` as a clean orchestrator.

### 2. UI/UX Overhaul (Admin Standard)
- **Layout**: Adopt a split layout.
  - **Sidebar**: Filters and Upload form.
  - **Main**: Statistics, Search, and Materials List.
- **Header**: Use `AdminHeader` with `StatGroup` for library summaries.
- **Materials List**: 
  - Switch from large cards to a high-density grid or table-like layout.
  - Show status badges (Visibility, Review, Processing) clearly but compactly.
- **Typography**: Enforce the Admin typographic scale (bold uppercase labels, tight display headers).
- **Refinement**: 
  - Reduce border-radius across the board.
  - Use `bg-surface-200` for the page background to match Admin.
  - Remove the "Processing help" banner/modal and use tooltips or subtle indicators instead.

### 3. Features
- **Search**: Prominent search bar in the main area.
- **Multi-select**: Maintain the ability to select sources for planning workspace.
- **Upload**: Integrated upload form in the sidebar with clear validation.
- **Material Editing**: Use an `AdminSheet` for editing material details.

## Implementation Steps
1. Create directory structure for `features/planning-library`.
2. Extract sub-components (MaterialCard, UploadForm, FilterSidebar).
3. Update `page.tsx` to use the new layout and components.
4. Apply Admin-themed styling (Tailwind).
5. Verify with `tsc`.

## Success Metrics
- Page loading feels snappier due to reduced DOM nodes.
- Information density increased (more materials visible at once).
- Visual consistency with Admin routes.
