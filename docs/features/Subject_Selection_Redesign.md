# Redesign Proposal: Teacher Subject Selection

The current Teacher Subject Selection page suffers from low information density, excessive instructional text, and redundant UI containers (cards within cards). This redesign aims to align the page with the high-density, tool-oriented aesthetic of the Admin dashboard.

## Goals

1.  **Eliminate "Slop"**: Remove redundant explanatory text and excessive card wrapping.
2.  **High Density**: Use `TeacherHeader` and `StatGroup` to present information efficiently.
3.  **Professional Aesthetic**: Match the Admin routes' tool-like feel.
4.  **Improved Interaction**: Refine the matrix table for better spacing and clearer visual feedback.

## Changes

### 1. Header & Stats

-   Replace the large header card with the `TeacherHeader` component.
-   Introduce a `StatGroup` to show:
    -   **Total Students**: Total count in the class.
    -   **Subjects**: Number of subjects offered.
    -   **Incomplete**: Number of students missing subject selections (replaces the amber alert).

### 2. Information Architecture

-   Remove the "Edit the live class matrix" and "Roster changes are admin-only" cards. These will be summarized in the `TeacherHeader` description or a subtle "Quick Reference" note if needed.
-   Move `EnrollmentFilters` to be more integrated into the top section, matching the Admin layout.

### 3. Subject Selection Matrix

-   Remove the explanatory paragraph within the matrix section.
-   Refine `SubjectSelectionDesktopTable`:
    -   Improve header contrast and typography.
    -   Increase checkbox size slightly for better tap targets and visibility.
    -   Adjust padding to reduce "dead space".
-   Streamline `SubjectSelectionMatrix` status messages (e.g., loading, empty states).

### 4. Layout

-   Ensure the layout feels balanced and professional, utilizing negative space better than the current "boxed" approach.

## Verification

-   Visual check against Admin dashboard styles.
-   Type check using `npx tsc --noEmit`.
