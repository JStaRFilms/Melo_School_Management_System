# Standard Protocol: Independent Scroll Workbench

## Overview
The "Independent Scroll Workbench" is a desktop-optimized layout pattern designed for complex administrative tasks. It replaces the standard `sticky` sidebar with two isolated scrollable "buckets," allowing users to scroll through long record lists while keeping fixed-depth forms (like builders or editors) in view—or vice versa.

## Core Architecture

### 1. The Fixed Viewport (Root)
To enable internal scrolling, the root container of the page must be locked to the viewport and prevent the body from scrolling.
```tsx
<div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200/50">
```

### 2. The Split Buckets
The content area is divided into two columns on desktop using `flex-row-reverse`. Each column is assigned `h-full` and `overflow-y-auto`.

- **Sidebar (aside):** Restricted width (e.g., `400px`), specific background (e.g., `bg-white/40 backdrop-blur-xl`), and high transparency/ghost scrollbars.
- **Main (main):** Occupies remaining space, typically contains the primary directory/grid within a `max-w` container for readability.

```tsx
<div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 overflow-hidden">
  {/* Sidebar Bucket */}
  <aside className="w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l ...">
     ...
  </aside>

  {/* Main Bucket */}
  <main className="flex-1 lg:h-full lg:overflow-y-auto ...">
     <div className="max-w-[1200px] mx-auto ...">
        ...
     </div>
  </main>
</div>
```

## Aesthetic Standards: Ghost Scrollbars
Scrollbars must be non-intrusive. They should be transparent by default and only reveal themselves (at a weight of `5px`) when the user hovers over a specific bucket.

```tsx
<style dangerouslySetInnerHTML={{ __html: `
  .custom-scrollbar::-webkit-scrollbar {
    width: 5px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: transparent;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(15, 23, 42, 0.15);
  }
`}} />
```

For maintainability, prefer placing the same rules in a shared global stylesheet or a CSS module and apply them through the `.custom-scrollbar` class. Inline style injection is acceptable for quick prototypes, but component-scoped or global CSS is the better default for production pages.

---

## 🤖 Builder Prompt: Implement Independent Scroll
*Give this prompt to an AI agent to refactor another page to this standard.*

> **Task:** Refactor the current page to use the "Independent Scroll Workbench" pattern.
> 
> **Architectural Constraints:**
> 1. Wrap the entire return block in a container that is `lg:h-screen lg:overflow-hidden flex flex-col`.
> 2. Implement the "Split Bucket" strategy:
>    - Create two main children in a `flex-row-reverse` container.
>    - **Sidebar Bucket:** `w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl`.
>    - **Main Bucket:** `flex-1 lg:h-full lg:overflow-y-auto`.
> 3. Inside the **Main Bucket**, wrap content in a `max-w-[1200px] mx-auto` div to maintain grid density.
> 4. Ensure mobile responsiveness: on `< LG` widths, the buckets should stack naturally and the page should regain normal vertical scrolling.
> 5. **Ghost Scrollbars:** Prefer a CSS module or shared stylesheet for the `custom-scrollbar` rules so the class stays reusable and easy to audit; use inline style injection only when you need a one-off prototype or temporary override.
