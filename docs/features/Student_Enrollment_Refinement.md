# Feature: Student Enrollment UI Refinement

## Goal

Streamline the Student Enrollment interface to match the Admin Portal's high-density, professional aesthetic. Resolve issues with over-spacing, excessive card usage, and redundant explanatory text.

## Problem Statement

The current `/academic/students` route is "fluffy" and over-explained. It uses too many nested card patterns, has disconnected headers/stats, and occupies excessive vertical space for simple filters.

## Design Direction

- **Density**: Transition from "educational" spacing to "tool-oriented" density.
- **Layout**: Sidebar on the RIGHT (`flex-row`).
- **Organization**: Use tabs in the sidebar for "Identity" and "Family" to prevent scrolling and maintain state across student selection.
- **Consistency**: Match the Admin Portal's professional look and feel.

## Components & Data Flow

### 1. `StudentsPage` (app/academic/students/page.tsx)

- **Layout**: Change to `flex-row` (Main on left, Sidebar on right).
- **State**: Add `activeTab` state to persist across student selection.
- **Sidebar**: Pass tab state to `StudentProfileEditor`.

### 2. `StudentProfileEditor` (components/StudentProfileEditor.tsx)

- **Tabs**: Implement a high-fidelity tab switcher (Identity vs Family).
- **Content**:
    - **Identity Tab**: Profile fields, photo, and portal credentials.
    - **Family Tab**: Family links and household management.
- **Persistence**: Tab state is managed by the parent (`StudentsPage`) to ensure it doesn't reset when switching students.

## Implementation Plan

1. **Phase 1**: Update `StudentsPage` layout to `flex-row` and add `activeTab` state.
2. **Phase 2**: Refactor `StudentProfileEditor` to include tabs and handle conditional rendering.
3. **Phase 3**: Refine the tab switcher aesthetic (Admin Portal style).
4. **Phase 4**: Verify state persistence across student selection.
