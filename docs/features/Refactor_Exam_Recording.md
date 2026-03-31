# Refactor: Exam Recording Settings

## Goal
Modernize the `/assessments/setup/exam-recording` route by implementing the **Independent Scroll Workbench** pattern. This refactor aims to:
1.  **Optimize Spacing**: Move from a card-heavy vertical stack to a high-density, split-bucket layout.
2.  **Reduce Card Overuse**: Integrate settings into a cohesive sidebar and main workspace.
3.  **Refine Typography**: Remove redundant explanatory text and emphasize system-level protocols.
4.  **Admin Alignment**: Ensure the UI matches the established "Hybrid Academic Interface" standards used in other admin modules.

## Architecture
- **Layout**: `lg:h-screen lg:overflow-hidden flex flex-col`
- **Sidebar (380px)**: 
  - Sticky settings for Exam Input Mode selection.
  - Policy configuration (Session/Term, Toggle, Dates).
  - Floating/Sticky Action Bar at the bottom of the sidebar.
- **Main Workspace**:
  - `AdminHeader` with breadcrumbs.
  - `Protocol Workspace`: Visual representation of weight distribution (`WeightDistribution`) and security/audit policies (`AuditPolicyCard`).

## Component Refinement
### 1. `ExamModeSelector`
- Vertical radio group (compact).
- Remove "Recommended for..." subtext.
- Integrated into the sidebar.

### 2. `AssessmentEditingPolicy`
- Move Session/Term selectors to the top of the sidebar.
- Redesign restriction toggle and date inputs to be more compact.
- Remove the "Pick the session and term..." instructional block.

### 3. `WeightDistribution` & `AuditPolicyCard`
- Merge into a "Protocol Dashboard/Summary" in the main area.
- Use `AdminSurface` with `low` intensity for a clean look.

## Data Flow
- Use existing Convex queries and mutations.
- Maintain draft state for unsaved changes verification.

## Implementation Steps
1.  **Refactor `page.tsx`**: Apply the layout structure.
2.  **Refactor Components**: Clean up sub-components to be more compact and high-density.
3.  **Visual Polish**: Ensure consistent desktop/mobile experience (Bottom Sheet for mobile edit).
