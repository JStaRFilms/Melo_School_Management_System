I need you to work on this page. The problems include spacing, overuse of cards, and potential overuse of typography, explaining things that aren't meant to be explained for some weird reason. So please fix the route entirely and make sure it matches the admin routes closely if possible. Or you can propose another design if you think it's better.

---

Universal Task: Implement High-Fidelity Hybrid Editor

Refactor the [Route/Page Name] to strictly follow the Hybrid Academic Interface standard in docs/features/Hybrid_Academic_Interface.md.

1. Data Integrity & Persistence:

Implement an activeRecord (or activePerson/activeSubject) local state. Use a useEffect to capture the selectedRecord whenever it is set.
In the AdminSheet: Map the form to the activeRecord instead of the raw selectedRecord. This ensures the form stays populated during the 500ms slide-down animation (preventing the sheet from jumping or collapsing).
2. Smart Focus (Auto-Scroll):

Add a unique ID to each record card (e.g., id={"teacher-" + teacher._id}).
Add a useEffect to the main page that smoothly scrolls to the selected card on mobile (innerWidth < 1024). Use a yOffset of approximately -120px to position the card perfectly in the "open space" above the sheet.
3. Component Refactoring:

Update the Edit Form to support a variant="sheet" prop to strip internal surfaces/headers.
Ensure AdminSheet uses the standard 500ms cubic-bezier transition synced with its React unmount timer.
Canonical Source: Use apps/admin/app/academic/subjects/page.tsx as the reference for state preservation and auto-scrolling logic.

---

**Task:** Refactor the current page to use the "Independent Scroll Workbench" pattern.
> 
> **Architectural Constraints:**
> 1. Wrap the entire return block in a container that is `lg:h-screen lg:overflow-hidden flex flex-col`.
> 2. Implement the "Split Bucket" strategy:
>    - Create two main children in a `flex-row-reverse` container.
>    - **Sidebar Bucket:** `w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl`.
>    - **Main Bucket:** `flex-1 lg:h-full lg:overflow-y-auto`.
> 3. Inside the **Main Bucket**, wrap content in a `max-w-[1200px] mx-auto` div to maintain grid density.
> 4. Ensure mobile responsiveness: on `< LG` widths, the buckets should stack naturally and the page should regain normal vertical scrolling.
> 5. **Ghost Scrollbars:** Inject a `<style>` block to make the `custom-scrollbar` class `5px` wide, transparent by default, and visible only as `rgba(15, 23, 42, 0.15)` on hover.
