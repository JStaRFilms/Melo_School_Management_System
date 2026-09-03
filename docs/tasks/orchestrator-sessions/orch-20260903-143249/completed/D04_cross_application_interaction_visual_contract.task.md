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

## Completion Status
- **Status**: Completed (2026-09-03)
- **Artifact Written**: `docs/features/D04_CrossApplicationInteractionAndVisualContract.md` (Version 1.0.0)
- **Verification & Specification Summary**:
  1. **Six Non-Negotiable UX Invariants**: Codified strict rules: Authoritative Denial (no fake 404s), Strict Progress Semantics (scroll vs. validated completion), Draft Decoupling (save state decoupled from progress; no silent overwrites), Zero False Offline Claims (connection lost vs saved truth), Semantic Color Sovereignty (theme tokens configure only Primary/Accent, never overwrite status or grade colors), Navigable Trash Workspace (analogous to Archive).
  2. **Authoritative 403 Forbidden View (H2)**: Complete component specification (`<AuthoritativeForbiddenView />`) detailing required capability key, active identity & title, active branch context, and actionable escalation remedy to School Proprietor/Principal.
  3. **Active Branch Switcher & Unsaved-State Seam (F2/H6)**: Top header switcher contract (`WorkspaceNavbar`) with dirty-form interception modal (`<UnsavedBranchSwitchModal />`) offering 3 explicit choices: "Stay on Current Branch", "Discard Changes & Switch", and "Save Draft & Switch".
  4. **Configurable Grade-Band Colors & Report Card Legibility (H1/F6)**: Builder UI with immutable standard defaults, curated accessible presets, hex picker with real-time WCAG 2.2 AA contrast calculation, mathematical derivation of contrast-safe foregrounds, monochrome laser print stylesheet contract (`@media print`), and 6-surface consumer inventory.
  5. **Bank Account Management & Payment Instruction Snapshots (H3)**: Masked account summary list (`•••••• 4892`), step-up re-authentication reveal with 60-second auto-mask timer, immutable invoice payment instruction snapshotting at issuance time, and receipt layout hiding bank instructions.
  6. **Sequential Admission Number Builder (H4)**: Token builder (`{SCHOOL}`, `{CAMPUS}`, `{LEVEL}`, `{YEAR}`, `{SEQ:n}`), live preview, atomic backend allocation during enrollment approval, manual override protocol with audit reason, and bulk import format comparison modal.
  7. **Shared Dirty-State Guard & Draft Recovery (H6)**: Interception across tab close/reload, client routing, navbar links, and branch switching; 1.5s debounced autosave; micro-pill status states (`saving`, `saved`, `connection_lost`, `save_failed`, `conflict`); `<DraftRecoveryModal />` preventing silent overwrites; multi-tab conflict resolution.
  8. **Shared Mobile Progress Indicator (H7)**: Compact sticky sub-header bar ($\le 32\text{px}$ height); strict bifurcation between Mode A (scroll percentage) and Mode B (validated section completion); embedded save status; rollout inventory across 6 core workflows.
  9. **Shared School Theme Tokens (F6)**: 2-input model (`primaryColor`, `accentColor`) deriving 8 CSS custom properties (`--school-primary`, `--school-primary-hover`, `--school-primary-surface`, `--school-primary-border`, `--school-primary-contrast`, `--school-accent`, `--school-accent-surface`, `--school-accent-contrast`, `--school-focus-ring`); `AGENTS.md` rules barring arbitrary Tailwind brand classes and protecting status colors.
  10. **Institutional Email Proposal Workbench (H5)**: Directory workbench with collision detection, suffix suggestions, manual local part editing, and 3 honest mailbox capability badges (`login_only`, `external_verified`, `provider_provisioned`).
  11. **Usage Metering Confirmation & Thresholds (H8)**: Non-intrusive toolbar quota pill, pre-flight confirmation modal for expensive batch operations, soft thresholds at 75% and 90%, and 100% hard-stop modal with top-up actions.
  12. **School Asset Library, Antivirus Quarantine & Navigable Trash (H9)**: Antivirus scanning badges (`Quarantined / Scanning`, `Clean`, `Infected / Quarantined`); first-class navigable Trash workspace (`/admin/assets/trash`) with 30-day countdown, item inspection, retention hold lock, restore, and audited purge; 3-part storage accounting bar; structural PDF compression pre-check card with explicit disqualification disclosures.
  13. **Commercial & Settlement Transparency (F7)**: Mode A (Direct School Merchant) 100% direct settlement confirmation vs. Mode B (Split-Mode) 5-item transparent ledger breakdown with T+1 business days estimated settlement schedule and CBN/NIBSS holiday disclosures.
  14. **Accessibility, Viewport & Print Compliance**: Full WCAG 2.2 AA matrix, mobile 320px single-column contract, monochrome print contract, reduced motion rules, and `aria-live` announcement standards.
