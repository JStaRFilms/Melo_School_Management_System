# Feature Refinement: Student Onboarding Interface

## Goal
Optimize the Student Onboarding interface for higher information density, better professional aesthetic, and superior mobile UX. The goal is to make it feel like a "workbench" rather than a traditional long form.

## Current Issues
- **Vertical Bloat**: Redundant navigation and large headers consume significant screen real estate.
- **Low Density**: Form sections use large icons and generous spacing, forcing unnecessary scrolling.
- **Disconnected Sidebar**: The class placement sidebar feels like an afterthought rather than a core part of the workflow.
- **Mobile Friction**: Long scroll distance on mobile and potentially overwhelming UI.

## Redesign Strategy

### 1. Unified Compact Header
- Merge the navigation and page title into a single, high-density bar.
- Use the established `AdminHeader` but in a more constrained way if possible, or create a custom "Workbench Header".
- Keep the "Live Enrollment Session" indicator but make it more subtle.

### 2. Denser Workbench Form
- Reduce section header sizes.
- Use a 2-column grid for most fields on desktop.
- Tighten up input heights and font sizes (staying readable but professional).
- Integrate the Photo Upload more tightly into the Identity Core.

### 3. Professional Configuration Sidebar
- Refine the Class Placement selection.
- Ensure the "Commit Enrollment" button is prominent and feels like the final "Save" action for the whole workbench.
- Add a "Progress" or "Summary" view if possible to show what's been filled.

### 4. Mobile UX Optimization
- Use a "Step" based approach or a very focused single-column layout with a persistent footer.
- Ensure the sticky bar at the bottom provides clear feedback on what's missing.

## Implementation Results
- **Unified Header**: Combined the previous nav and `AdminHeader` into a single `header` element with a 1-column layout for title/status on mobile and 2-column on desktop.
- **Denser workbench**: 
  - Section icons reduced to `h-8 w-8`.
  - Section titles reduced to `text-sm`.
  - Field inputs reduced to `h-9` with `text-[13px]`.
  - Section vertical spacing reduced from `12` to `10`.
- **Integrated Profile Core**: The student photo is now a `col-span-3` element inside the `Identity Core` section on desktop, creating a cohesive "profile card" feel during entry.
- **Sidebar Efficiency**: Reduced sidebar width from `380px` to `340px` and tightened class placement buttons for better density.
- **Type Safety**: Verified with `npx tsc --noEmit`.

## Visual Improvements
- The workbench now feels like a professional tool rather than a generic form.
- The "Profile" starts immediately after the header, maximizing vertical real estate.
- The sidebar feels like a configuration pane rather than a "random side".
