# Feature: Refactor Students Workbench

## Goal
Modernize the `/academic/students` page by implementing the "Independent Scroll Workbench" pattern. This will replace the current card-heavy layout with a high-density, split-bucket interface that separates student management/editing (Sidebar) from the enrollment matrix (Main content).

## Layout Structure
- **Container**: `lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200`
- **Sidebar (Right, Desktop)**: `lg:w-[450px] lg:h-full lg:overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl custom-scrollbar p-6`
  - Purpose: Contains `StudentCreationForm` (when no student selected) or `StudentProfileEditor` (when a student is selected).
- **Main Content (Left, Desktop)**: `flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-6`
  - Purpose: Contains `AdminHeader`, `EnrollmentFilters`, and the `SubjectSelectionMatrix`.

## Key Changes
1.  **Simplify Header**: Remove verbose explanatory text. Use `AdminHeader` with `StatGroup` for matrix summary.
2.  **Ghost Scrollbars**: Inject custom CSS for clean, high-density scrollbars.
3.  **Mobile Refinement**: Use `AdminSheet` for editing student profiles on mobile.
4.  **Density**: Use `AdminSurface` and consistent spacing to reduce visual clutter.
5.  **State Management**: Maintain `selectedStudentId` to toggle between creation and editing in the sidebar.

## Data Flow
- **RSC Default**: The page remains a Client Component (`"use client"`) due to heavy interactivity with Convex queries and mutations.
- **Matrix Interaction**: Toggling subjects in the matrix remains instant via Convex mutations.
- **Sidebar Sync**: Selecting a student in the matrix updates `selectedStudentId`, which swaps the creation form for the profile editor in the sidebar.

## Components to Reuse/Update
- `AdminHeader`: For the title and stats.
- `StatGroup`: For matrix status (Total Students, Total Subjects, etc.).
- `AdminSheet`: For mobile editing.
- `StudentCreationForm` & `StudentProfileEditor`: Updated to fit the new workbench layout.
- `SubjectSelectionMatrix`: The core focal point of the main area.
