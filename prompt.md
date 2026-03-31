I need you to work on this page. The problems include spacing, overuse of cards, and potential overuse of typography, explaining things that aren't meant to be explained for some weird reason. So please fix the route entirely and make sure it matches the admin routes closely if possible. Or you can propose another design if you think it's better.



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