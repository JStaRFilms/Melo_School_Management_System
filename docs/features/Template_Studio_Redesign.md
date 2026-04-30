# Blueprint: Template Studio Redesign

## Goal

Redesign the `/academic/knowledge/templates` route to improve information density, reduce card-bloat, and remove redundant explanations, aligning with the high-end admin dashboard aesthetic.

## Aesthetic Direction: "Technical Elegance"

- **Brutally Minimalist yet Informative**: Focus on data and tools, not instructions.
- **High Density**: Reduce whitespace in sidebars and headers.
- **Glassmorphism & Depth**: Use subtle blurs and gradients for a premium feel.
- **Refined Typography**: Use weights and tracking instead of long descriptions.

## Components Structure

- `InstructionTemplateStudioScreen.tsx`: Main orchestrator.
- `TemplateListPanel.tsx`: Sidebar catalog with search and filters.
- `TemplateEditor.tsx`: Designer workspace for template configuration.
- `TemplateMonitor.tsx`: Live preview and resolution audit.
- `TemplateSectionList.tsx`: Specialized component for managing sections.
- `TemplateActionBar.tsx`: Bottom action area for saving/discarding.

## Data Flow

- Unified `draft` state in `InstructionTemplateStudioScreen`.
- Mutations handled at the page level.
- Real-time validation and "Resolution Rank" calculation.

## Changes

1. **Header**: Compact `AdminHeader` with streamlined `StatGroup`.
2. **Catalog Sidebar**:
   - Denser list items.
   - Integrated search.
   - Remove redundant "Template Catalog" label if possible.
3. **Tabs**: Horizontal segmented control for Output Type.
4. **Editor**:
   - Merge "Template Identity" and "Objective Minimums" into a cohesive layout.
   - Remove all "explanatory" text (e.g., "Output type is controlled by...").
   - Section management: Cleaner, table-like rows instead of nested cards.
5. **Monitor**:
   - Dark-mode inspired preview card for high contrast.
   - Simplified "Resolution Ladder".

## Verification

- Run `npx tsc --noEmit` in `apps/admin`.
- Visual check of all screen sizes.
