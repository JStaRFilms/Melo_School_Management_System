# Feature: Archived Records Page (Admin)

## Goal
Provide a dedicated interface for school admins to browse, filter, and audit archived academic records (subjects, classes, teachers, sessions) without hard-deleting sensitive historical data.

## User Story
As a school admin, I want to view a list of all archived records so that I can audit why they were archived, who archived them, and ensure historical data remains accessible for past report cards or compliance.

## Components

### 1. Summary Header
- **Counts:** Total archived Items, split by type (Classes, Subjects, Teachers, Sessions).
- **Vibe:** Premium cards with subtle borders and clear numbers.

### 2. Global Filters & Search
- **Segmented Control/Tabs:** Switch between record types (All, Classes, Subjects, Teachers, Sessions).
- **Search Bar:** Real-time filtering by name or admission number (for students if applicable) or teacher name.
- **Date Filter:** Filter by archival date range.

### 3. Responsive Record List
- **Table (Desktop):** Name, Type, Archived Date, Archived By, Reason/Status.
- **Cards (Mobile):** High-density cards showing key info with a "Detail" chevron.
- **Status Chips:** Clear badges for the record type.

### 4. Detail Drawer (Side Panel)
- Opens when a record is selected.
- Shows full metadata:
  - Original creation date.
  - Archival timestamp.
  - Archival author.
  - Blockers encountered during archival (if any).
  - Linked history snippet.
- **Note:** Restoration is not implemented in this view to prevent accidental resurrection without full setup validation.

### 5. Empty & Error States
- **Empty State:** Clean illustration/icon with messaging like "No archived records found. Your history is clean."
- **Loading State:** Shimmer/Skeleton effects.
- **Error State:** Clear alert with a retry action.

## Design Aesthetic
- **Font:** Plus Jakarta Sans.
- **Colors:** Platform Neutrals (FAFAFA backgrounds), Platform Primary (3B82F6).
- **Shadows:** Subtle (`shadow-sm` or custom `--card-shadow`).
- **Mobile-First:** Single column cards on small screens, transitioning to full tables on desktop.

## Layout Plan
1.  **Top Navigation:** Breadcrumbs + Title.
2.  **Summary Stats:** 4 cards in a grid (1 col mobile, 4 col desktop).
3.  **Controls:** Search + Tabs (sticky on mobile).
4.  **Content Area:** The list or empty/loading state.
5.  **Overlay:** Side drawer for details.
