# Unified Report Card Print System

## Overview

A shared, unified print system for report cards across all surfaces (admin, teacher, and parent/student portal). Ensures consistent A4 preview and print behavior, eliminates duplicate print logic, and maintains a single source of truth for report card rendering.

## Why This Architecture

The previous implementation had separate print logic per surface, leading to:
- Inconsistent preview sizing across admin, teacher, and portal
- Print output not matching preview
- Duplicated toolbar and print button components
- Content being cut off due to fixed-height containers

This unified system ensures one shared component tree used everywhere.

## Architecture

### Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `ReportCardSheet` | `packages/shared/src/components/ReportCardSheet.tsx` | Core A4 layout, contains print CSS, no toolbar |
| `ReportCardToolbar` | `packages/shared/src/components/ReportCardToolbar.tsx` | Shared toolbar with Back button + Export/Print button |
| `ReportCardPreview` | `packages/shared/src/components/ReportCardPreview.tsx` | 65% scaled preview wrapper for on-screen display |
| `ReportCardPrintStack` | `packages/shared/src/components/ReportCardPrintStack.tsx` | Full-class print (uses Sheet directly, one page per student) |
| `ReportCardPrintBlockedNotice` | `packages/shared/src/components/ReportCardToolbar.tsx` | Warning when cumulative print is blocked |

### Print CSS Architecture

The print system uses injected CSS (via `ensurePrintStyles()`) that:
1. Sets `@page { size: A4 portrait; margin: 0 }` for full-bleed printing
2. Removes the preview scale transform during print
3. Anchors `.rc-print-root` to `position: fixed` at top-left with exact A4 dimensions
4. Hides `.rc-no-print` elements (toolbar, buttons)
5. Ensures content stretches to full A4 width

### Surface Integration

All three surfaces (admin, teacher, portal) use the same pattern:

```tsx
<ReportCardToolbar
  studentName={reportCard.student.name}
  backHref="/results/entry"
/>
{hasIncompleteCumulativeResults(reportCard) && (
  <ReportCardPrintBlockedNotice />
)}
<ReportCardPreview
  reportCard={reportCard}
  backHref="/results/entry"
  hideToolbar
/>
```

### Key Decisions

1. **Toolbar is external** - The toolbar lives outside `ReportCardSheet` so it can be used consistently across surfaces
2. **Preview uses transform scaling** - The preview renders at full size then scales down to 65% for on-screen display
3. **Print removes transform** - Print CSS overrides the transform to render at full A4 size
4. **Fixed height removed** - `ReportCardSheet` uses `minHeight` instead of fixed height to allow content to flow
5. **Overflow visible** - Content is not clipped so teacher comments and extras are always visible

## Files Changed

### Created
- `packages/shared/src/components/ReportCardToolbar.tsx` - Shared toolbar component
- `packages/shared/src/components/ReportCardPreview.tsx` - Scaled preview wrapper

### Modified
- `packages/shared/src/components/ReportCardSheet.tsx` - Removed internal toolbar, removed scaling logic, added print CSS fixes
- `packages/shared/src/index.ts` - Exported new components

### Updated Surfaces
- `apps/admin/app/assessments/report-cards/page.tsx` - Uses ReportCardToolbar + ReportCardPreview
- `apps/teacher/app/assessments/report-cards/page.tsx` - Uses ReportCardToolbar + ReportCardPreview
- `apps/portal/app/(portal)/components/PortalWorkspace.tsx` - Uses ReportCardToolbar + ReportCardPreview

## Print Behavior

### On-Screen Preview
- Renders at full A4 size (210mm × 297mm)
- Scaled down to 65% via CSS transform
- Shows shadow and rounded corners for visual appearance

### Print Output
- Removes transform scaling
- Full A4 dimensions (210mm width)
- 8mm padding
- No shadows or rounded corners
- Toolbar hidden automatically

### Full-Class Print
- Uses `ReportCardPrintStack` which renders each card at full size
- One student per page via `page-break-after: always`
- No toolbar on any page

## Future Extensibility

When adding new report card features:
1. Add the feature to `ReportCardSheet` - it propagates to all surfaces automatically
2. If surface-specific controls are needed, add them outside the sheet (like toolbar)
3. Never duplicate print logic in surface pages - keep it in shared components
4. Test both preview and print output when making changes

## Changelog

### 2026-04-17: Unified Print System
- **Problem:** Inconsistent preview and broken print across surfaces
- **Solution:** Created shared toolbar, fixed container height/overflow, rewrote print CSS to remove transform and use fixed positioning for proper A4 output