# Feature: Teacher Planning Redesign

## Goal
Redesign the Teacher Planning interface to align with the Admin dashboard's aesthetic and functional patterns. The new design should improve spacing, reduce the overuse of cards, and remove excessive explanatory text.

## Current Issues
- **Spacing:** Inconsistent and overly generous padding/margins.
- **Card Overload:** Everything is wrapped in a large, heavy card.
- **Typography:** Verbose "helper" text that clutters the UI.
- **Consistency:** Does not match the sleek, sidebar-driven design of the Admin routes.

## Design Direction
- **Layout:** Adopt the Admin layout pattern: a scrollable main content area for "Recent/Active Work" and a sidebar for "Actions/Creation" (Topic & Exam setup).
- **Header:** Use a refined header with stats (e.g., Total Topics, Recent Lessons, Question Bank count).
- **Work Items:** Replace the large cards in "Continue Work" with a more compact, data-rich grid or list.
- **Creation:** Move "Topic Work" and "Exam Work" selectors into the sidebar. This keeps the main view focused on *work* rather than *setup*.
- **Aesthetics:** Use `surface-200` background, refined borders, and the "Admin-style" uppercase tracking for labels.

## Components
- `TeacherHeader`: Adapted from `AdminHeader`.
- `PlanningWorkGrid`: A compact grid of active topics.
- `PlanningSidebar`: Contains creation forms for "Topic Workspace" and "Exam Workspace".
- `PlanningStatGroup`: Metrics for teacher activity.

## Data Flow
- **Queries:**
  - `listTeacherPlanningTopicWork`: For the main work grid.
  - `getTeacherAssignableClasses`, `getTeacherActiveTerms`, `getTeacherAssignableSubjectsByClass`: For selectors.
  - `listTeacherKnowledgeTopics`: For topic selection/search.
- **Mutations:**
  - `createTeacherKnowledgeTopic`: For new topic creation.

## Approval Required
- [ ] Transition to Sidebar-driven layout.
- [ ] Removal of hero banner and verbose text.
- [ ] Adoption of Admin design tokens.
