# Feature: Hybrid Academic Interface (Mobile Sheet + Desktop Sidebar)

## Overview
To improve mobile usability across the Admin Portal, we have implemented a **Hybrid Editor Pattern**. This pattern ensures that managing large catalogs (Subjects, Teachers, Classes, etc.) remains high-density on desktop while providing a focused, buttery-smooth experience on mobile.

## Design Pattern

### 1. The Workbench (Desktop)
On desktop screens (`lg` and above), the interface is a locked professional workbench:
- **Sticky Actions**: The creation or edit forms are locked to the right side using `sticky top-8`.
- **Primary Content**: The main catalog is a flexible grid on the left.
- **Intensity**: Uses `AdminSurface` with `intensity="high"` for active editing.

### 2. The Focus Sheet (Mobile/Tablet)
On mobile devices (`sm` and `md`), the interface uses a high-performance bottom sheet:
- **AdminSheet Editor**: Selecting an item for editing triggers a bottom sheet pop-up.
- **Smart Focus**: The page automatically scrolls to the selected card, positioning it in the "open space" above the sheet (approx. Top 20% of the viewport).
- **Glassmorphism Overlay**: The background is dimmed with a `backdrop-blur-[4px]` while the sheet is solid white for maximum legibility.
- **Smooth Exit (Syncing)**: Content must be preserved during dismissal to avoid "height jumping" or "flicking" and the sheet's 500ms CSS transition must be synchronized with the React unmount timer.

## Implementation Standards

### 1. Data Preservation (Crucial for Animations)
To avoid the sheet collapsing its height during the "slide down" exit, use an `activeRecord` state to hold onto the data until the animation finishes.

```tsx
const [activeItem, setActiveItem] = useState<ItemRecord | null>(null);

useEffect(() => {
  if (selectedItem) setActiveItem(selectedItem);
}, [selectedItem]);
```

### 2. Smart Focus Coordination
Add a unique ID to each card (e.g., `id={"item-" + item._id}`) and trigger a smooth scroll on selection:

```tsx
useEffect(() => {
  if (selectedId && window.innerWidth < 1024) {
    setTimeout(() => {
      const element = document.getElementById(`item-${selectedId}`);
      if (element) {
        const yOffset = -120; // Positions the card comfortably above the sheet
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
  }
}, [selectedId]);
```

### 3. Usage inside AdminSheet
The sheet should only be active for mobile/tablet screens to avoid redundant overlays on desktop (where the sticky sidebar is already present).

```tsx
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 1024);
  checkMobile();
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);

<AdminSheet 
  isOpen={Boolean(selectedId) && isMobile} 
  onClose={() => setSelectedId(null)}
  title="Edit Item"
>
  {activeItem && <ItemEditForm subject={activeItem} variant="sheet" />}
</AdminSheet>
```

## Related Components
- `apps/admin/lib/components/ui/AdminSheet.tsx` (500ms Cubic-Bezier sync)
- `apps/admin/lib/components/ui/AdminSurface.tsx` (Grounding elements)
- `apps/admin/lib/components/ui/AdminHeader.tsx` (Stats & metrics)
