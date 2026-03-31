# Feature Blueprint: Academic Classes Interface Refactor

## Goal
Transform the academic classes management interface from a card-heavy, verbose layout into a high-density "Hybrid Academic Workbench" that aligns with the established admin route standards.

## Problems Addressed
- **Overuse of Cards**: Current layout uses multiple large cards which waste vertical space.
- **Redundant Typography**: Explanatory text that provides little value and adds clutter.
- **Inconsistent Spacing**: Variable padding and margins making the UI feel "loose".
- **UX Complexity**: Selecting a class for editing shifts the entire grid, causing layout instability.

## Design Solution: The Hybrid Workbench
We will implement a dual-mode interface:
1. **Desktop (LG+):** A two-column workbench with a sticky sidebar for creation/editing and a high-density grid for active records.
2. **Mobile (<LG):** A focused list of records that opens a premium bottom sheet (`AdminSheet`) for editing.

## Component Architecture

### 1. `ClassCard.tsx`
- High-density compact card showing Grade, Label, Form Teacher, and Student Count.
- Action-oriented: single click to select/edit.
- Visual state for `isSelected`.

### 2. `ClassCreationForm.tsx`
- Minimalist specialized form for defining new class blueprints.
- Integrated into the sticky sidebar.

### 3. `ClassEditForm.tsx`
- Comprehensive form for updating grade details, form teachers, and subject offerings.
- Includes the `ClassAggregationManager` and teacher-subject mapping.

### 4. `ClassSection.tsx` (Internal utility)
- Groups classes by level (Nursery, Primary, Secondary).
- Compact headers with section-specific icons.

## Data Flow & State
- `selectedClassId`: Stores the ID of the class currently being viewed/edited.
- `activeClass`: A local state copy of the selected class to prevent layout shifts when Convex queries update.
- `isMobile`: Layout switch based on viewport width.

## Implementation Steps
1. **Initialize Directory**: Clean up `apps/admin/app/academic/classes/components/`.
2. **Build Components**: Implement the new card and forms.
3. **Assemble Page**: Update `page.tsx` with the new layout and state logic.
4. **Logic Migration**: Move business logic into the new component structure.
5. **Verify**: Ensure smooth transitions, auto-scrolling on mobile, and type safety.
