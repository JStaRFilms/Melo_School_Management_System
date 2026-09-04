# Task D04: Cross-Application Interaction and Visual Contract (H1/H3/H4/H6/H7/F6/H8/H9/F7)

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-design` and `engineering-principles` workflow before starting this task.
### Prime Agent Context
Prime the task with:
- `docs/tasks/orchestrator-sessions/orch-20260903-143249/product-decisions.md` (H1, H3, H4, H6, H7, F6, H8, H9, F7)
- `docs/tasks/orchestrator-sessions/orch-20260903-143249/task-packets.md` (packet D-04)
- `docs/features/D02_IdentityGroupRBACAndAuditArchitecture.md`
- `docs/features/D03_ProviderRuntimeAndSettlementSpikes.md`
- `docs/design/design-system.md` and `docs/features/UnifiedWorkspaceNavbar.md`

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

## Context
Parent session: orch-20260903-143249  
Task title: Cross-Application Interaction and Visual Contract  
Author: Staff Product Designer & Design Systems Engineer  

## Definition Of Done
- Progress semantics strictly distinguish scroll position from validated section completion.
- Draft status clearly distinct from progress status.
- No false offline functionality claims.
- Theme tokens never replace semantic status or grade colors.
- School Assets Trash is a first-class, navigable area analogous to Archive.
- WCAG 2.2 AA contrast, 320px mobile viewport, print preview, reduced motion, and screen reader annotations.

## Expected Artifacts
- `docs/features/D04_CrossApplicationInteractionAndVisualContract.md`

## Dependencies
- D-02 architecture (Complete)
- D-03 provider/runtime outcomes (Complete)

## Constraints
- Follow existing design system in `docs/design/` and Tailwind patterns; avoid decorative cards, gradients, or oversized typography.

## Delivery Record

- **Historical artifact:** The initial D-task document was delivered on 2026-09-03.
- **Current authority:** The corrected feature document and master plan govern review status.
- **Evidence boundary:** This delivery record does not establish legal, provider, runtime, browser/accessibility, migration/restore, security, or release validation.

## Correction status (2026-09-03)

This completion record is superseded for review purposes by the corrected D-01–D-05 feature bundle. The artifact remains delivered, but independent milestone re-review is pending. It does not evidence legal approval, provider/runtime validation, browser/accessibility validation, migration/restore proof, or release authorization.
