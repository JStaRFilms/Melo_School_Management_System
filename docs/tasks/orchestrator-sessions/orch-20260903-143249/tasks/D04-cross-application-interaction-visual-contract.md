# Task D-04: Cross-Application Interaction and Visual Contract (H1/H3/H4/H6/H7/F6/H8/H9/F7)

## Objective
Design reusable user flows, UI components, responsive layouts, and accessible interaction contracts before vertical builds begin.

## Scope
- Permission denied / navigation hiding states (clear explanation, no misleading 404s).
- Active branch switcher in workspace header with unsaved-state protection seams.
- Configurable grade-band color builder, preview, and printed / grayscale report card legibility contract (contrast compliance, semantic indicator only, not whole-page themes).
- School bank settings UI (masked vs full numbers, proprietor authorization) and issued invoice payment-instruction snapshots.
- Admission number token builder with live preview and collision/format feedback.
- Shared dirty-state / unsaved guard and draft recovery (timestamped resume/preview/discard, autosave vs explicit save, connectivity loss warning, no "work offline" falsehood).
- Shared mobile progress bar (compact sticky beneath header, distinct scroll vs validated section completion).
- Shared theme settings (Primary and Accent bases only, mathematical derivation of soft/contrast variants, CSS variables, AGENTS.md rules, status color protection).
- Institutional email address proposal and confirmation workflows.
- Usage confirmation dialogs for costly AI/OCR/storage operations.
- School asset library: private grid/list, quarantine indicator, visible and navigable Trash (with restore, retention hold, permanent delete), and compression status.
- Commercial & settlement transparency (direct merchant vs split disclosures).

## Definition of Done
- Progress semantics strictly distinguish scroll position from validated section completion.
- Draft status clearly distinct from progress status.
- No false offline functionality claims.
- Theme tokens never replace semantic status or grade colors.
- School Assets Trash is a first-class, navigable area analogous to Archive.
- WCAG 2.2 AA contrast, 320px mobile viewport, print preview, reduced motion, and screen reader annotations.

## Expected Artifacts
- `docs/features/D04_CrossApplicationInteractionAndVisualContract.md`
- Task completion record

## Dependencies
- D-02 architecture; relevant D-03 provider/runtime outcomes

## Constraints
- Follow existing design system in `docs/design/` and Tailwind patterns; avoid decorative cards, gradients, or oversized typography.
