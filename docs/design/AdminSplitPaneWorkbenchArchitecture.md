# Admin Split-Pane Workbench Architecture & Input Guidelines

**Target Audience:** Frontend Engineers & Autonomous Agents  
**Scope:** Admin Portal Workbench layouts (`/academic/classes`, `/academic/subjects`, `/academic/teachers`, etc.)

---

## 1. The Split-Pane Workbench Pattern

Admin workbench pages utilize a dual-mode layout:
1. **Desktop (`lg:` / `xl:`)**: A two-column split workbench where the **Right Sidebar** (Creation / Edit Form) is permanently pinned in place, while the **Left Main Column** (List of Cards / Catalog) scrolls independently.
2. **Mobile (`< lg`)**: A single-column vertically scrolling layout where selecting a record opens a bottom modal sheet (`AdminSheet`).

---

## 2. Desktop Layout Structure (`lg:` / `xl:`)

To prevent the entire page or right sidebar from sliding up under the navbar when scrolling, all split-pane workbench pages MUST follow this container hierarchy:

```tsx
// 1. Page Root: Bounded to full height on desktop with overflow hidden
<div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">

  // 2. Split Wrapper: Bounded height and flex row (row-reverse to keep DOM order clean)
  <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">

    // 3. Right Sidebar: LOCKED & PINNED
    // - Must have `lg:h-full lg:overflow-hidden flex flex-col justify-between shrink-0`
    <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
      
      // Form content scrolls internally if tall, without shifting the sidebar frame:
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-4">
        {selectedRecord ? <EditForm /> : <CreationForm />}
      </div>

      // Action buttons or inventory status stay pinned at the bottom:
      <div className="pt-3 border-t border-slate-200/60 shrink-0">
        <PinnedActionsOrStatus />
      </div>
    </aside>

    // 4. Left Main Content: Independent Scroll Area
    // - Must have `lg:h-full lg:overflow-y-auto custom-scrollbar`
    <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
      <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-8">
        <AdminHeader ... />
        <CardGrid ... />
      </div>
    </main>
  </div>
</div>
```

### Key Rules for Pinned Panels:
- ❌ **NEVER** place `lg:overflow-y-auto` on the `<aside>` root element itself. Doing so allows the entire sidebar frame (including headers and footers) to slide out of view.
- ✅ **ALWAYS** place `lg:overflow-hidden flex flex-col justify-between` on `<aside>`, and put `flex-1 min-h-0 overflow-y-auto` on the inner content `<div>`.
- ✅ **ALWAYS** ensure parent containers have `min-h-0 lg:h-full` so flex child heights are bounded and independent scrollbars trigger properly.

---

## 3. Global Shell Integration (`WorkspaceNavbar.tsx`)

In `packages/shared/src/components/WorkspaceNavbar.tsx`:
- The right column container must have `min-h-0 h-full` to prevent flex items from defaulting to `min-height: auto`.
- The `<main>` scroll container uses:
  ```tsx
  <main
    className={`flex-1 min-h-0 w-full relative custom-scrollbar scrollbar-hide ${
      fullBleed
        ? "overflow-y-auto lg:overflow-hidden"
        : "overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
    }`}
  >
    <div className={fullBleed ? "w-full min-h-full lg:h-full lg:min-h-0" : "mx-auto max-w-[1600px]"}>
      {children}
    </div>
  </main>
  ```
- This ensures:
  1. **Mobile devices (`< lg`)**: Have 100% smooth vertical touch scrolling site-wide via `overflow-y-auto min-h-full`.
  2. **Desktop devices (`lg:` / `xl:`)**: Have strict container lock via `lg:overflow-hidden` so scrolling mousewheel on the right sidebar NEVER slides or scrolls the outer workbench frame.

---

## 4. Controlled Input Cursor Position Rule

### The Bug
When `onChange` intercepts the input value and immediately formats or mutates the string (e.g. capitalizing tokens via `humanNameTyping(...)`), React replaces the DOM input's controlled `value` with a transformed string. The browser resets `selectionStart` and `selectionEnd` to the **end of the input** (`value.length`).

As a result:
- If a user moves their cursor to the beginning of a word and deletes a letter, the cursor jumps to the end of the text.
- Editing in the middle or start of words becomes frustratingly broken.

### The Standard Pattern:
```tsx
// ❌ WRONG: Mutating string on every keystroke in onChange
<input
  value={name}
  onChange={(e) => setName(humanNameTyping(e.target.value))}
/>

// ✅ CORRECT: Preserve raw keystrokes in onChange, format on onBlur & onSubmit
<input
  value={name}
  onChange={(e) => setName(e.target.value)}
  onBlur={(e) => setName(humanNameFinal(e.target.value))}
/>
```

When submitting forms:
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const cleanName = humanNameFinal(name.trim());
  // submit cleanName...
};
```
